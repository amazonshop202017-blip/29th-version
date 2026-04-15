import { useState, useEffect } from 'react';
import { Plus, MoreVertical, ExternalLink, Ruler, Edit2, Trash2, PlayCircle } from 'lucide-react';
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
import { useTradedSymbols } from '@/hooks/useTradedSymbols';
import { useSymbolTickSize, type TickPipRule } from '@/contexts/SymbolTickSizeContext';
import { TypeableCombobox } from '@/components/trades/TypeableCombobox';
import { toast } from 'sonner';

export const SymbolTickSizeManagement = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showApplyTo, setShowApplyTo] = useState(false);

  // Form state
  const [formAccountIds, setFormAccountIds] = useState<string[]>([]);
  const [formSymbol, setFormSymbol] = useState('');
  const [formTickSize, setFormTickSize] = useState('');
  const [formContractSize, setFormContractSize] = useState('1');

  const { accounts } = useAccountsContext();
  const { selectedAccounts, isAllAccountsSelected } = useGlobalFilters();
  const tradedSymbols = useTradedSymbols();
  const { tickPipRules, addTickPipRule, updateTickPipRule, deleteTickPipRule, setTickSize } = useSymbolTickSize();

  const activeAccounts = accounts.filter(a => !a.isArchived);

  // Auto-select accounts from global filter when opening Add modal
  useEffect(() => {
    if (showModal && !editingRuleId) {
      if (!isAllAccountsSelected && selectedAccounts.length > 0) {
        // selectedAccounts contains account names, map to IDs
        const ids = selectedAccounts
          .map(name => accounts.find(a => a.name === name)?.id)
          .filter(Boolean) as string[];
        setFormAccountIds(ids);
      }
    }
  }, [showModal, isAllAccountsSelected, selectedAccounts, editingRuleId, accounts]);

  const resetForm = () => {
    setFormAccountIds([]);
    setFormSymbol('');
    setFormTickSize('');
    setFormContractSize('1');
  };

  const handleSave = () => {
    if (formAccountIds.length === 0 || !formSymbol.trim()) return;

    const tickVal = parseFloat(formTickSize);
    const contractVal = parseFloat(formContractSize);

    if (isNaN(tickVal) || tickVal <= 0) {
      toast.error('Tick / Pip Value must be a positive number');
      return;
    }
    if (isNaN(contractVal) || contractVal <= 0) {
      toast.error('Contract Size must be a positive number');
      return;
    }

    const resolvedNames = formAccountIds
      .map(id => accounts.find(a => a.id === id)?.name)
      .filter(Boolean) as string[];

    if (resolvedNames.length === 0) return;

    // Register new symbol in tick-size registry with default value
    if (!tradedSymbols.includes(formSymbol.trim())) {
      setTickSize(formSymbol.trim(), tickVal);
    }

    if (editingRuleId) {
      updateTickPipRule(editingRuleId, {
        accountIds: formAccountIds,
        symbol: formSymbol.trim(),
        tickSize: tickVal,
        contractSize: contractVal,
      });
      toast.success('Rule updated');
    } else {
      addTickPipRule({
        accountIds: formAccountIds,
        symbol: formSymbol.trim(),
        tickSize: tickVal,
        contractSize: contractVal,
      });
      toast.success('Rule created');
    }

    resetForm();
    setEditingRuleId(null);
    setShowModal(false);
  };

  const handleEdit = (rule: TickPipRule) => {
    setEditingRuleId(rule.id);
    setFormAccountIds(rule.accountIds);
    setFormSymbol(rule.symbol);
    setFormTickSize(rule.tickSize.toString());
    setFormContractSize(rule.contractSize.toString());
    setShowModal(true);
  };

  const handleDelete = (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    deleteTickPipRule(ruleId);
    toast.success('Rule deleted');
  };

  const handleAddNewSymbol = (symbol: string) => {
    setFormSymbol(symbol);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Ruler className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Symbol Tick / Pip & Contract Size</h2>
                <a href="#" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Learn more <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-sm text-muted-foreground">Define tick/pip and contract size rules per account & symbol</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { resetForm(); setEditingRuleId(null); setShowModal(true); }} size="sm">
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
                <TableHead>Symbol</TableHead>
                <TableHead>Tick / Pip Value</TableHead>
                <TableHead>Contract Size</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickPipRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Ruler className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No tick/pip rules defined yet</p>
                    <p className="text-xs mt-1">Click "Add rule" to create your first rule</p>
                  </TableCell>
                </TableRow>
              ) : (
                tickPipRules.map((rule) => (
                  <TableRow key={rule.id} className="border-border">
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.accountIds.map((id) => {
                          const acc = accounts.find(a => a.id === id);
                          return (
                            <Badge key={id} variant="secondary" className="text-xs">{acc?.name ?? 'Unknown'}</Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>{rule.symbol}</TableCell>
                    <TableCell>{rule.tickSize}</TableCell>
                    <TableCell>{rule.contractSize}</TableCell>
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
                          <DropdownMenuItem onClick={() => setShowApplyTo(true)} className="cursor-pointer">
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

      {/* Add/Edit Rule Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setEditingRuleId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRuleId ? 'Edit Tick/Pip Rule' : 'Add Tick/Pip Rule'}</DialogTitle>
            <DialogDescription>{editingRuleId ? 'Update tick/pip and contract size values' : 'Define tick/pip and contract size for an account & symbol'}</DialogDescription>
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

            {/* Tick / Pip Value */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tick / Pip Value</label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 0.01"
                value={formTickSize}
                onChange={e => setFormTickSize(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            {/* Contract Size */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Contract Size</label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 100"
                value={formContractSize}
                onChange={e => setFormContractSize(e.target.value)}
                className="bg-input border-border"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetForm}>Reset</Button>
            <Button onClick={handleSave} disabled={formAccountIds.length === 0 || !formSymbol.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplyToModal open={showApplyTo} onOpenChange={setShowApplyTo} />
    </div>
  );
};
