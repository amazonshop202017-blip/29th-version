import { useState, useEffect } from 'react';
import { Plus, MoreVertical, ExternalLink, Target, Edit2, Trash2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ApplyToModal } from '@/components/settings/ApplyToModal';
import { MultiAccountSelect } from '@/components/settings/MultiAccountSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useTradesContext } from '@/contexts/TradesContext';
import { useTradedSymbols } from '@/hooks/useTradedSymbols';
import { useSymbolTickSize } from '@/contexts/SymbolTickSizeContext';
import { TypeableCombobox } from '@/components/trades/TypeableCombobox';
import { cn } from '@/lib/utils';
import { computeAutoTpSl } from '@/lib/tpslCalculation';
import { calculateTradeMetrics, TradeFormData } from '@/types/trade';

export interface TpSlRule {
  id: string;
  accountIds: string[];
  instrument: string;
  symbol: string;
  type: string;
  profitTargetUnit: 'tick' | 'dollar';
  profitTargetValue: number;
  stopLossUnit: 'tick' | 'dollar';
  stopLossValue: number;
  createdAt: string;
}

const STORAGE_KEY = 'trading-journal-tpsl-rules';

const migrateRule = (raw: any): TpSlRule => {
  const rule: TpSlRule = {
    id: raw.id,
    accountIds: raw.accountIds || [],
    instrument: raw.instrument || '—',
    symbol: raw.symbol,
    type: raw.type || 'Standard',
    profitTargetUnit: raw.profitTargetUnit,
    profitTargetValue: raw.profitTargetValue,
    stopLossUnit: raw.stopLossUnit,
    stopLossValue: raw.stopLossValue,
    createdAt: raw.createdAt,
  };
  if (rule.accountIds.length === 0 && raw.accountId) {
    rule.accountIds = [raw.accountId];
  }
  return rule;
};

const loadRules = (): TpSlRule[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return (JSON.parse(stored) as any[]).map(migrateRule);
  } catch {
    return [];
  }
};

const saveRules = (rules: TpSlRule[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
};

export const TpSlSettings = () => {
  const [rules, setRules] = useState<TpSlRule[]>(loadRules);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showApplyTo, setShowApplyTo] = useState(false);
  const [applyingRule, setApplyingRule] = useState<TpSlRule | null>(null);

  // Form state
  const [formAccountIds, setFormAccountIds] = useState<string[]>([]);
  const [formSymbol, setFormSymbol] = useState('');
  const [formPtUnit, setFormPtUnit] = useState<'tick' | 'dollar'>('tick');
  const [formPtValue, setFormPtValue] = useState('');
  const [formSlUnit, setFormSlUnit] = useState<'tick' | 'dollar'>('tick');
  const [formSlValue, setFormSlValue] = useState('');

  const { accounts } = useAccountsContext();
  const { selectedAccounts, isAllAccountsSelected, currencyConfig } = useGlobalFilters();
  const { trades, bulkUpdateTrades } = useTradesContext();
  const tradedSymbols = useTradedSymbols();
  const { setTickSize, getTickSizeForAccountSymbol } = useSymbolTickSize();

  const activeAccounts = accounts.filter(a => !a.isArchived);

  const handleApplyTo = (emptyOnly: boolean, overwrite: boolean) => {
    if (!applyingRule) return;
    if (!emptyOnly && !overwrite) return;

    const rule = applyingRule;
    const matchingTrades = trades.filter(
      t => rule.accountIds.includes(t.accountId) && t.symbol === rule.symbol
    );

    const updates = new Map<string, Partial<TradeFormData>>();

    for (const trade of matchingTrades) {
      const metrics = calculateTradeMetrics(trade);
      if (metrics.avgEntryPrice <= 0) continue;

      const tickSize = getTickSizeForAccountSymbol(trade.accountId, trade.symbol);
      if (!tickSize || tickSize <= 0) continue;

      const { tp, sl } = computeAutoTpSl(rule, metrics.avgEntryPrice, trade.side, tickSize);

      const tpEmpty = trade.takeProfit === undefined || trade.takeProfit === null;
      const slEmpty = trade.stopLoss === undefined || trade.stopLoss === null;

      let newTp = trade.takeProfit;
      let newSl = trade.stopLoss;

      if (emptyOnly) {
        // Only apply to trades where BOTH TP and SL are empty
        if (!tpEmpty || !slEmpty) continue;
        newTp = tp;
        newSl = sl;
      } else if (overwrite) {
        // Only apply to trades that have at least one existing TP or SL value
        if (tpEmpty && slEmpty) continue;
        newTp = tp;
        newSl = sl;
      }

      // Skip if nothing changed
      if (newTp === trade.takeProfit && newSl === trade.stopLoss) continue;

      const updatedTrade = { ...trade, takeProfit: newTp, stopLoss: newSl };
      const updatedMetrics = calculateTradeMetrics(updatedTrade);

      const patch: Partial<TradeFormData> = {
        takeProfit: newTp,
        stopLoss: newSl,
      };

      // Recalculate saved RRR
      if (newTp !== undefined && newSl !== undefined && metrics.avgEntryPrice > 0) {
        const risk = Math.abs(metrics.avgEntryPrice - newSl);
        const reward = Math.abs(newTp - metrics.avgEntryPrice);
        if (risk > 0) {
          patch.savedRRR = reward / risk;
        }
      }

      // Recalculate R-Multiple
      if (trade.tradeRisk > 0 && updatedMetrics.positionStatus === 'CLOSED') {
        patch.savedRMultiple = updatedMetrics.netPnl / trade.tradeRisk;
      }

      // Recalculate Return %
      if (trade.accountBalanceSnapshot && trade.accountBalanceSnapshot > 0) {
        patch.savedReturnPercent = (updatedMetrics.netPnl / trade.accountBalanceSnapshot) * 100;
      }

      updates.set(trade.id, patch);
    }

    if (updates.size > 0) {
      bulkUpdateTrades(updates);
    }

    toast.success(`TP/SL rule applied to ${updates.size} trade${updates.size !== 1 ? 's' : ''}`);
  };

  // Auto-select accounts from global filter
  useEffect(() => {
    if (showAddModal && !editingRuleId) {
      if (!isAllAccountsSelected && selectedAccounts.length > 0) {
        setFormAccountIds([...selectedAccounts]);
      }
    }
  }, [showAddModal, isAllAccountsSelected, selectedAccounts, editingRuleId]);

  const resetForm = () => {
    setFormAccountIds([]);
    setFormSymbol('');
    setFormPtUnit('tick');
    setFormPtValue('');
    setFormSlUnit('tick');
    setFormSlValue('');
  };

  const handleSave = () => {
    if (formAccountIds.length === 0 || !formSymbol) return;

    // Register new symbol in tick-size registry with default value
    if (!tradedSymbols.includes(formSymbol)) {
      setTickSize(formSymbol, 0.01);
    }

    if (editingRuleId) {
      const updated = rules.map(r =>
        r.id === editingRuleId
          ? {
              ...r,
              accountIds: formAccountIds,
              symbol: formSymbol,
              profitTargetUnit: formPtUnit,
              profitTargetValue: parseFloat(formPtValue) || 0,
              stopLossUnit: formSlUnit,
              stopLossValue: parseFloat(formSlValue) || 0,
            }
          : r
      );
      setRules(updated);
      saveRules(updated);
    } else {
      const newRule: TpSlRule = {
        id: crypto.randomUUID(),
        accountIds: formAccountIds,
        instrument: '—',
        symbol: formSymbol,
        type: 'Standard',
        profitTargetUnit: formPtUnit,
        profitTargetValue: parseFloat(formPtValue) || 0,
        stopLossUnit: formSlUnit,
        stopLossValue: parseFloat(formSlValue) || 0,
        createdAt: nowISO(),
      };
      const updated = [...rules, newRule];
      setRules(updated);
      saveRules(updated);
    }

    resetForm();
    setEditingRuleId(null);
    setShowAddModal(false);
  };

  const handleEdit = (rule: TpSlRule) => {
    setEditingRuleId(rule.id);
    setFormAccountIds(rule.accountIds);
    setFormSymbol(rule.symbol);
    setFormPtUnit(rule.profitTargetUnit);
    setFormPtValue(rule.profitTargetValue.toString());
    setFormSlUnit(rule.stopLossUnit);
    setFormSlValue(rule.stopLossValue.toString());
    setShowAddModal(true);
  };

  const handleDelete = (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this TP / SL rule?')) return;
    const updated = rules.filter(r => r.id !== ruleId);
    setRules(updated);
    saveRules(updated);
  };

  const handleAddNewSymbol = (symbol: string) => {
    setFormSymbol(symbol);
  };

  const formatValue = (unit: 'tick' | 'dollar', value: number) => {
    if (unit === 'dollar') return `${currencyConfig.symbol}${value}`;
    return `${value} tick${value !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">TP / SL Settings</h2>
                <a href="#" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Learn more <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-sm text-muted-foreground">Define profit target and stop loss rules per symbol</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { resetForm(); setEditingRuleId(null); setShowAddModal(true); }} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add rule
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">Options coming soon</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Account</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead>Symbols</TableHead>
                <TableHead>Profit Targets</TableHead>
                <TableHead>Stop Losses</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Target className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No TP / SL rules defined yet</p>
                    <p className="text-xs mt-1">Click "Add rule" to create your first rule</p>
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id} className="border-border">
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.accountIds.map((id) => {
                          const acc = accounts.find(a => a.id === id);
                          return <Badge key={id} variant="secondary" className="text-xs">{acc?.name ?? 'Unknown'}</Badge>;
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rule.instrument}</TableCell>
                    <TableCell>{rule.symbol}</TableCell>
                    <TableCell className="text-profit">{formatValue(rule.profitTargetUnit, rule.profitTargetValue)}</TableCell>
                    <TableCell className="text-loss">{formatValue(rule.stopLossUnit, rule.stopLossValue)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem onClick={() => handleEdit(rule)} className="cursor-pointer">
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setApplyingRule(rule); setShowApplyTo(true); }} className="cursor-pointer">
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Apply To
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(rule.id)} className="cursor-pointer text-loss">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Rule Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => { setShowAddModal(open); if (!open) setEditingRuleId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRuleId ? 'Edit TP / SL Rule' : 'Add TP / SL Rule'}</DialogTitle>
            <DialogDescription>{editingRuleId ? 'Update profit target and stop loss values' : 'Define profit target and stop loss for a symbol'}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Account */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Account(s)</label>
              <MultiAccountSelect
                accounts={activeAccounts}
                selectedIds={formAccountIds}
                onChange={setFormAccountIds}
                placeholder="Select accounts..."
              />
            </div>

            {/* Instrument (disabled) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Instrument</label>
              <Input disabled placeholder="Coming soon" className="bg-muted/30 border-border opacity-50 cursor-not-allowed" />
            </div>

            {/* Symbol */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Symbol</label>
              <TypeableCombobox
                value={formSymbol}
                onChange={setFormSymbol}
                options={tradedSymbols}
                onAddNew={handleAddNewSymbol}
                placeholder="Select or type symbol..."
              />
            </div>

            {/* Type / Take Profit / Stop Loss */}
            <div className="space-y-3">
              {/* Unit selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Unit Type</label>
                <div className="flex h-10 rounded-md border border-border overflow-hidden w-fit">
                  <button
                    type="button"
                    onClick={() => { setFormPtUnit('tick'); setFormSlUnit('tick'); }}
                    className={cn(
                      "px-4 text-sm font-medium transition-colors",
                      formPtUnit === 'tick'
                        ? "bg-primary text-primary-foreground"
                        : "bg-input text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Tick / Pip
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormPtUnit('dollar'); setFormSlUnit('dollar'); }}
                    className={cn(
                      "px-4 text-sm font-medium transition-colors border-l border-border",
                      formPtUnit === 'dollar'
                        ? "bg-primary text-primary-foreground"
                        : "bg-input text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {currencyConfig.symbol}
                  </button>
                </div>
              </div>

              {/* TP / SL inputs side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-profit">Take Profit</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={formPtUnit === 'tick' ? 'Ticks / Pips' : currencyConfig.symbol + ' value'}
                    value={formPtValue}
                    onChange={e => setFormPtValue(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-loss">Stop Loss</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={formSlUnit === 'tick' ? 'Ticks / Pips' : currencyConfig.symbol + ' value'}
                    value={formSlValue}
                    onChange={e => setFormSlValue(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetForm}>Reset</Button>
            <Button onClick={handleSave} disabled={formAccountIds.length === 0 || !formSymbol}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplyToModal open={showApplyTo} onOpenChange={setShowApplyTo} onApply={handleApplyTo} context="tpsl" />
    </div>
  );
};
