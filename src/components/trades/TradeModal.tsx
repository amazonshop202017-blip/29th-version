import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useTradedSymbols } from '@/hooks/useTradedSymbols';
import { X, Calendar, Star, Settings2, Clock, ChevronDown, Check, Plus, Info, Tags } from 'lucide-react';
import { ScaleInOutModal } from './ScaleInOutModal';
import { AssignTagsModal } from './AssignTagsModal';
import { ScreenshotsTab } from './ScreenshotsTab';
import { TypeableCombobox } from './TypeableCombobox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTradeModal } from '@/contexts/TradeModalContext';
import { useTradesContext } from '@/contexts/TradesContext';
import { useStrategiesContext } from '@/contexts/StrategiesContext';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomStats } from '@/contexts/CustomStatsContext';
import { useTagsContext } from '@/contexts/TagsContext';
import { useSymbolTickSize } from '@/contexts/SymbolTickSizeContext';
import { TradeFormData, TradeEntry, ScaleEntry, TradeScreenshot, calculateTradeMetrics, Trade } from '@/types/trade';
import { getContractSizeForSymbol } from '@/lib/contractSizeRegistry';
import { loadFeeRules, findMatchingFeeRule, calculateFeeFromRule } from '@/lib/feeCalculation';
import { loadTpSlRules, findMatchingTpSlRule, computeAutoTpSl } from '@/lib/tpslCalculation';
import { toISO, nowISO, isoToDateTimeLocalInputValue } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { TradeModalErrorBoundary } from './TradeModalErrorBoundary';

function roundForPlaceholder(price: number): number {
  const abs = Math.abs(price);
  let step: number;
  if (abs >= 1000) step = 10;      // 5664 → 5660
  else if (abs >= 100) step = 1;   // 234.7 → 235
  else if (abs >= 10) step = 0.1;  // 65.46 → 65.5
  else if (abs >= 1) step = 0.01;  // 5.436 → 5.44
  else step = 0.001;               // 0.0846 → 0.085
  return Math.round(price / step) * step;
}

const defaultEntry = (): TradeEntry => ({
  id: crypto.randomUUID(),
  type: 'BUY',
  datetime: isoToDateTimeLocalInputValue(nowISO()),
  quantity: 0,
  price: 0,
  charges: 0,
});

export const TradeModal = () => {
  const { isOpen, editingTrade, initialEntryDate, closeModal } = useTradeModal();
  const { trades, addTrade, updateTrade } = useTradesContext();
  const { strategies, getStrategyById } = useStrategiesContext();
  const { accounts, getAccountWithStats, getAccountBalanceBeforeTrades } = useAccountsContext();
  const { currencyConfig, selectedAccounts: globalSelectedAccounts, isAllAccountsSelected } = useGlobalFilters();
  const { tickSizes, contractSizes, setContractSize, getTickSizeForAccountSymbol, getContractSizeForAccountSymbol } = useSymbolTickSize();
  const { 
    addEntryComment,
    addTradeManagement,
    addExitComment,
    getActiveEntryComments,
    getActiveTradeManagements,
    getActiveExitComments,
  } = useCustomStats();

  // Symbol options: single source of truth shared with Settings → Symbol Tick/Pip
  const symbolOptions = useTradedSymbols();

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Form state
  const [activeTab, setActiveTab] = useState('regular');
  
  const [strategyId, setStrategyId] = useState<string>('');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accountError, setAccountError] = useState(false);
  
  // Trade Entry fields
  const [entryDate, setEntryDate] = useState('');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  
  // Trade Exit fields
  const [exitDate, setExitDate] = useState('');
  const [exitPrice, setExitPrice] = useState<string>('');
  const [fees, setFees] = useState<string>('');
  const [manualGrossPnl, setManualGrossPnl] = useState<string>('');
  
  // Additional fields
  const [symbol, setSymbol] = useState('');
  const [notes, setNotes] = useState('');
  const [tradeRisk, setTradeRisk] = useState(0);
  const [tradeTarget, setTradeTarget] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedChecklistItems, setSelectedChecklistItems] = useState<string[]>([]);
  
  // Hidden fields for compatibility
  const [entries, setEntries] = useState<TradeEntry[]>([defaultEntry()]);

  // Scale In/Out modal state and data
  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleEntries, setScaleEntries] = useState<ScaleEntry[]>([]);
  const [scaleExits, setScaleExits] = useState<ScaleEntry[]>([]);
  // Dynamically computed open quantity - reacts to form changes without needing save
  const openQuantity = useMemo(() => {
    if (scaleEntries.length > 0) {
      const totalEntryQty = scaleEntries.reduce((sum, e) => sum + e.quantity, 0);
      const totalExitQty = scaleExits.reduce((sum, e) => sum + e.quantity, 0);
      return Math.max(0, totalEntryQty - totalExitQty);
    }
    // Fallback: compute from entries array
    if (entries.length > 0) {
      let netPosition = 0;
      for (const entry of entries) {
        if (entry.type === 'BUY') {
          netPosition += entry.quantity;
        } else {
          netPosition -= entry.quantity;
        }
      }
      return Math.abs(netPosition);
    }
    // New trade with no entries yet — consider open
    const qty = parseFloat(quantity) || 0;
    const hasExit = exitPrice !== '' && parseFloat(exitPrice) > 0;
    return hasExit ? 0 : qty;
  }, [scaleEntries, scaleExits, entries, quantity, exitPrice]);

  // Assign Tags modal state
  const [assignTagsModalOpen, setAssignTagsModalOpen] = useState(false);

  // Advanced Data fields
  const [entryComment, setEntryComment] = useState('');
  const [tradeManagement, setTradeManagement] = useState('');
  const [exitComment, setExitComment] = useState('');
  const [farthestPriceInProfit, setFarthestPriceInProfit] = useState<string>('');
  const [farthestPriceInLoss, setFarthestPriceInLoss] = useState<string>('');
  const [priceReachedFirst, setPriceReachedFirst] = useState<'takeProfit' | 'stopLoss' | ''>('');
  const [breakEven, setBreakEven] = useState<boolean | null>(null);
  // After-exit (visual only — not persisted yet)
  const [afterExitOpen, setAfterExitOpen] = useState(false);
  const [afterExitHighest, setAfterExitHighest] = useState<string>('');
  const [afterExitLowest, setAfterExitLowest] = useState<string>('');
  
  // Screenshots state
  const [screenshots, setScreenshots] = useState<TradeScreenshot[]>([]);


  // Get current strategy's checklist items
  const currentStrategyChecklist = useMemo(() => {
    if (!strategyId) return [];
    const strategy = getStrategyById(strategyId);
    return strategy?.checklistItems || [];
  }, [strategyId, getStrategyById]);

  // Sync simplified fields to entries format
  useEffect(() => {
    const newEntries: TradeEntry[] = [];
    const entryPriceNum = parseFloat(entryPrice) || 0;
    const quantityNum = parseFloat(quantity) || 0;
    const exitPriceNum = parseFloat(exitPrice) || 0;
    const feesNum = parseFloat(fees) || 0;
    
    // Entry transaction
    if (entryDate && entryPriceNum >= 0 && quantityNum > 0) {
      newEntries.push({
        id: entries[0]?.id || crypto.randomUUID(),
        type: direction === 'LONG' ? 'BUY' : 'SELL',
        datetime: toISO(entryDate) || nowISO(),
        quantity: quantityNum,
        price: entryPriceNum,
        charges: 0,
      });
    }
    
    // Exit transaction
    if (exitDate && exitPriceNum >= 0 && quantityNum > 0) {
      newEntries.push({
        id: entries[1]?.id || crypto.randomUUID(),
        type: direction === 'LONG' ? 'SELL' : 'BUY',
        datetime: toISO(exitDate) || nowISO(),
        quantity: quantityNum,
        price: exitPriceNum,
        charges: feesNum,
      });
    }
    
    if (newEntries.length > 0) {
      setEntries(newEntries);
    }
  }, [entryDate, entryPrice, quantity, exitDate, exitPrice, fees, direction]);

  // Reset checklist items when strategy changes
  useEffect(() => {
    if (!editingTrade) {
      setSelectedChecklistItems([]);
    }
  }, [strategyId]);

  // Clear account error when account is selected
  useEffect(() => {
    if (selectedAccountId) {
      setAccountError(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (editingTrade) {
      setSymbol(editingTrade.symbol);
      // Set account ID directly
      setSelectedAccountId(editingTrade.accountId || '');
      setStrategyId(editingTrade.strategyId || '');
      setSelectedTags(editingTrade.tags);
      setSelectedChecklistItems(editingTrade.selectedChecklistItems || []);
      setNotes(editingTrade.notes || '');
      setTradeRisk(editingTrade.tradeRisk);
      setTradeTarget(editingTrade.tradeTarget || 0);
      setStopLoss(editingTrade.stopLoss !== undefined ? editingTrade.stopLoss.toString() : '');
      setTakeProfit(editingTrade.takeProfit !== undefined ? editingTrade.takeProfit.toString() : '');

      // Load scale entries/exits if available
      if (editingTrade.scaleEntries && editingTrade.scaleEntries.length > 0) {
        setScaleEntries(editingTrade.scaleEntries);
      }
      if (editingTrade.scaleExits && editingTrade.scaleExits.length > 0) {
        setScaleExits(editingTrade.scaleExits);
      }
      
      // Parse entries to simplified format
      if (editingTrade.entries.length > 0) {
        const sortedEntries = [...editingTrade.entries].sort((a, b) => 
          new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        );
        
        const firstEntry = sortedEntries[0];
        const lastEntry = sortedEntries.length > 1 ? sortedEntries[sortedEntries.length - 1] : null;
        
        // Determine direction from first entry
        setDirection(firstEntry.type === 'BUY' ? 'LONG' : 'SHORT');
        setEntryDate(isoToDateTimeLocalInputValue(firstEntry.datetime));
        setEntryPrice(firstEntry.price.toString());
        setQuantity(firstEntry.quantity.toString());
        
        if (lastEntry && lastEntry.id !== firstEntry.id) {
          setExitDate(isoToDateTimeLocalInputValue(lastEntry.datetime));
          setExitPrice(lastEntry.price.toString());
        }
        
        setEntries(editingTrade.entries);
      }

      // Set manual fees if it exists (user-entered override, even if 0)
      if (editingTrade.manualFees !== undefined) {
        setFees(editingTrade.manualFees.toString());
      }

      // Set manual gross P/L if it exists
      if (editingTrade.manualGrossPnl !== undefined) {
        setManualGrossPnl(editingTrade.manualGrossPnl.toString());
      }

      // Load Advanced Data fields
      setEntryComment(editingTrade.entryComment || '');
      setTradeManagement(editingTrade.tradeManagement || '');
      setExitComment(editingTrade.exitComment || '');
      setFarthestPriceInProfit(editingTrade.preMfePrice != null ? editingTrade.preMfePrice.toString() : '');
      setFarthestPriceInLoss(editingTrade.preMaePrice != null ? editingTrade.preMaePrice.toString() : '');
      setPriceReachedFirst(editingTrade.priceReachedFirst || '');
      setBreakEven(editingTrade.breakEven ?? null);
      
      // Load screenshots
      setScreenshots(editingTrade.screenshots || []);
      
    } else {
      resetForm();
      // If an initial entry date was provided (e.g. from calendar), use it
      if (initialEntryDate) {
        setEntryDate(isoToDateTimeLocalInputValue(initialEntryDate) || initialEntryDate);
      }
      // Auto-select account when exactly one account is selected in global filter (Add Trade only)
      // globalSelectedAccounts now contains account IDs (UUIDs)
      if (!isAllAccountsSelected && globalSelectedAccounts.length === 1) {
        setSelectedAccountId(globalSelectedAccounts[0]);
      }
    }
  }, [editingTrade, isOpen, initialEntryDate]);

  const resetForm = () => {
    setActiveTab('regular');
    setSymbol('');
    setSelectedAccountId('');
    setAccountError(false);
    setStrategyId('');
    setSelectedTags([]);
    setSelectedChecklistItems([]);
    setNotes('');
    setDirection('LONG');
    setEntryDate(isoToDateTimeLocalInputValue(nowISO()));
    setEntryPrice('');
    setQuantity('');
    setStopLoss('');
    setTakeProfit('');
    setExitDate('');
    setExitPrice('');
    setFees('');
    setManualGrossPnl('');
    setTradeRisk(0);
    setTradeTarget(0);
    setEntries([defaultEntry()]);
    // Reset scale data
    setScaleEntries([]);
    setScaleExits([]);
    // openQuantity is now derived via useMemo, no need to reset
    // Reset Advanced Data
    setEntryComment('');
    setTradeManagement('');
    setExitComment('');
    setFarthestPriceInProfit('');
    setFarthestPriceInLoss('');
    setPriceReachedFirst('');
    setBreakEven(null);
    // Reset screenshots
    setScreenshots([]);
  };

  const metrics = useMemo(() => {
    const formData: TradeFormData = {
      symbol,
      side: direction,
      entries,
      tradeRisk,
      tradeTarget,
      accountId: selectedAccountId,
      strategyId: strategyId || undefined,
      tags: selectedTags,
      notes,
      contractSize: editingTrade
        ? editingTrade.contractSize
        : (getContractSizeForAccountSymbol(selectedAccountId, symbol.trim())),
      preMfeTickPip: null,
      preMaeTickPip: null,
    };
    return calculateTradeMetrics(formData);
  }, [symbol, direction, entries, tradeRisk, tradeTarget, selectedAccountId, strategyId, selectedTags, notes, editingTrade]);

  // Auto-calculate fee from fee rules when manualFees is not set
  const calculatedFee = useMemo(() => {
    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    if (!selectedAccount || !symbol.trim()) return 0;
    const rules = loadFeeRules();
    const rule = findMatchingFeeRule(rules, selectedAccountId, symbol.trim());
    if (!rule) return 0;

    // When editing, use the original trade's full entries array (preserves all executions)
    if (editingTrade) {
      return calculateFeeFromRule(rule, editingTrade.entries, editingTrade.side);
    }

    // For new trades: if scale entries/exits exist, build a full TradeEntry[] from them
    // so fee calculation counts every individual execution (not the simplified 2-entry array)
    if (scaleEntries.length > 0) {
      const fullEntries: TradeEntry[] = [];
      const entryType: 'BUY' | 'SELL' = direction === 'LONG' ? 'BUY' : 'SELL';
      const exitType: 'BUY' | 'SELL' = direction === 'LONG' ? 'SELL' : 'BUY';

      for (const se of scaleEntries) {
        fullEntries.push({
          id: se.id,
          type: entryType,
          datetime: toISO(entryDate) || nowISO(),
          quantity: se.quantity,
          price: se.price,
          charges: 0,
        });
      }
      for (const sx of scaleExits) {
        fullEntries.push({
          id: sx.id,
          type: exitType,
          datetime: toISO(exitDate) || nowISO(),
          quantity: sx.quantity,
          price: sx.price,
          charges: 0,
        });
      }
      return calculateFeeFromRule(rule, fullEntries, direction);
    }

    // Fallback: use the simplified modal entries (simple entry + exit)
    return calculateFeeFromRule(rule, entries, direction);
  }, [selectedAccountId, symbol, entries, direction, accounts, editingTrade, scaleEntries, scaleExits, entryDate, exitDate]);

  // Auto-calculate TP/SL placeholders from TP/SL rules + tick size (mirrors fee placeholder pattern)
  const calculatedTpSl = useMemo(() => {
    // Only for new trades or when TP/SL fields are empty
    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    if (!selectedAccountId || !symbol.trim()) return { tp: undefined as number | undefined, sl: undefined as number | undefined };
    const ep = parseFloat(entryPrice);
    if (!ep || ep <= 0) return { tp: undefined, sl: undefined };

    const trimmedSymbol = symbol.trim();
    const tickSize = getTickSizeForAccountSymbol(selectedAccountId, trimmedSymbol);
    if (!tickSize || tickSize <= 0) return { tp: undefined, sl: undefined };

    const rules = loadTpSlRules();
    const rule = findMatchingTpSlRule(rules, selectedAccountId, trimmedSymbol);
    if (!rule) return { tp: undefined, sl: undefined };

    return computeAutoTpSl(rule, ep, direction, tickSize);
  }, [selectedAccountId, symbol, entryPrice, direction, accounts, getTickSizeForAccountSymbol]);

  // Dynamic placeholder for MFE/MAE inputs based on current entry price
  const mfeMaePlaceholder = useMemo(() => {
    const ep = parseFloat(entryPrice);
    if (!isFinite(ep) || ep <= 0) return '0.00';
    const rounded = roundForPlaceholder(ep);
    return `e.g. ${parseFloat(rounded.toFixed(3)).toString()}`;
  }, [entryPrice]);

  // For editing, use the original trade's metrics for auto-calculated gross PnL
  // so multi-entry trades retain correct values instead of using rebuilt simplified entries
  const editingTradeGrossPnl = useMemo(() => {
    if (!editingTrade) return metrics.grossPnl;
    const origMetrics = calculateTradeMetrics(editingTrade);
    return editingTrade.manualGrossPnl !== undefined ? editingTrade.manualGrossPnl : origMetrics.grossPnl;
  }, [editingTrade, metrics.grossPnl]);

  // The placeholder value for the Gross PnL field
  const grossPnlPlaceholder = editingTrade ? editingTradeGrossPnl : metrics.grossPnl;

  // Calculate actual gross and net P/L
  const effectiveGrossPnl = manualGrossPnl !== '' ? parseFloat(manualGrossPnl) || 0 : grossPnlPlaceholder;
  const effectiveFees = fees !== '' ? (parseFloat(fees) || 0) : calculatedFee;
  const effectiveNetPnl = effectiveGrossPnl - effectiveFees;

  // Calculate account balance snapshot (BEFORE any trade P/L)
  // This is: startingBalance + deposits - withdrawals
  const accountBalanceSnapshot = useMemo(() => {
    if (!selectedAccountId) return 0;
    return getAccountBalanceBeforeTrades(selectedAccountId);
  }, [selectedAccountId, getAccountBalanceBeforeTrades]);

  // Calculate Return (%) based on account balance BEFORE trade
  // For Add Trade: recalculates when account or P/L values change
  // For Edit Trade: uses saved value unless P/L-affecting fields change or account changes
  const calculatedReturnPercent = useMemo(() => {
    if (!selectedAccountId || accountBalanceSnapshot <= 0) return 0;
    
    // Return % = Net P/L ÷ Account Balance (before trade) × 100
    return (effectiveNetPnl / accountBalanceSnapshot) * 100;
  }, [selectedAccountId, effectiveNetPnl, accountBalanceSnapshot]);

  // For editing: track if P/L-affecting fields or account have changed from original
  const pnlFieldsChanged = useMemo(() => {
    if (!editingTrade) return true; // Always calculate for new trades
    
    // Check if account changed
    const accountChanged = editingTrade.accountId !== selectedAccountId;
    if (accountChanged) return true;
    
    // Compare current values with original trade values
    const origMetrics = calculateTradeMetrics(editingTrade);
    const origNetPnl = editingTrade.manualGrossPnl !== undefined 
      ? editingTrade.manualGrossPnl - origMetrics.totalCharges 
      : origMetrics.netPnl;
    
    return Math.abs(effectiveNetPnl - origNetPnl) > 0.001;
  }, [editingTrade, effectiveNetPnl, selectedAccountId]);

  // For editing: track if R-Multiple-affecting fields changed (entry, exit, stopLoss, direction)
  const rMultipleFieldsChanged = useMemo(() => {
    if (!editingTrade) return true; // Always calculate for new trades
    
    // Get original values from editing trade
    const origEntries = editingTrade.entries || [];
    const origSortedEntries = [...origEntries].sort((a, b) => 
      new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );
    const origFirstEntry = origSortedEntries[0];
    const origLastEntry = origSortedEntries.length > 1 ? origSortedEntries[origSortedEntries.length - 1] : null;
    
    const origEntryPrice = origFirstEntry?.price || 0;
    const origExitPrice = origLastEntry?.price || 0;
    const origStopLoss = editingTrade.stopLoss || 0;
    const origDirection = editingTrade.side;
    
    const currentEntryPrice = parseFloat(entryPrice) || 0;
    const currentExitPrice = parseFloat(exitPrice) || 0;
    const currentStopLoss = parseFloat(stopLoss) || 0;
    
    // Check if any R-Multiple input changed
    return (
      Math.abs(currentEntryPrice - origEntryPrice) > 0.0001 ||
      Math.abs(currentExitPrice - origExitPrice) > 0.0001 ||
      Math.abs(currentStopLoss - origStopLoss) > 0.0001 ||
      direction !== origDirection
    );
  }, [editingTrade, entryPrice, exitPrice, stopLoss, direction]);

  // Final return percent to display - for edit, use saved unless P/L changed
  const displayReturnPercent = useMemo(() => {
    if (editingTrade && !pnlFieldsChanged && editingTrade.savedReturnPercent !== undefined) {
      return editingTrade.savedReturnPercent;
    }
    return calculatedReturnPercent;
  }, [editingTrade, pnlFieldsChanged, calculatedReturnPercent]);

  // Calculate duration
  const durationFormatted = useMemo(() => {
    if (!entryDate || !exitDate) return '—';
    const entryTime = new Date(entryDate).getTime();
    const exitTime = new Date(exitDate).getTime();
    if (isNaN(entryTime) || isNaN(exitTime) || exitTime < entryTime) return '—';
    
    const diffMs = exitTime - entryTime;
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const mins = totalMinutes % 60;
    
    return `${days}D ${hours}H ${mins}M`;
  }, [entryDate, exitDate]);

  // Validation - minimum required fields
  const canSave = symbol.trim() && entryDate && (parseFloat(entryPrice) >= 0) && (parseFloat(quantity) > 0);

  const handleSubmit = () => {
    if (!canSave) return;

    // Validate account is selected
    if (!selectedAccountId) {
      setAccountError(true);
      setActiveTab('regular');
      // Scroll to top
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    // accountId (UUID) is stored directly on the trade — no name resolution needed

    const tradeData: TradeFormData = {
      symbol: symbol.trim(),
      side: direction,
      entries,
      tradeRisk,
      tradeTarget,
      accountId: selectedAccountId,
      strategyId: strategyId || undefined,
      selectedChecklistItems,
      tags: selectedTags,
      notes: notes.trim(),
      stopLoss: stopLoss !== '' ? parseFloat(stopLoss) : (calculatedTpSl.sl !== undefined ? calculatedTpSl.sl : undefined),
      takeProfit: takeProfit !== '' ? parseFloat(takeProfit) : (calculatedTpSl.tp !== undefined ? calculatedTpSl.tp : undefined),
      manualGrossPnl: manualGrossPnl !== '' ? parseFloat(manualGrossPnl) : undefined,
      manualFees: fees !== '' ? parseFloat(fees) : (calculatedFee > 0 ? calculatedFee : undefined),
      scaleEntries: scaleEntries.length > 0 ? scaleEntries : undefined,
      scaleExits: scaleExits.length > 0 ? scaleExits : undefined,
      entryComment: entryComment || undefined,
      tradeManagement: tradeManagement || undefined,
      exitComment: exitComment || undefined,
      preMfePrice: farthestPriceInProfit !== '' ? parseFloat(farthestPriceInProfit) : null,
      preMaePrice: farthestPriceInLoss !== '' ? parseFloat(farthestPriceInLoss) : null,
      priceReachedFirst: priceReachedFirst || undefined,
      breakEven: breakEven ?? undefined,
      savedReturnPercent: editingTrade && !pnlFieldsChanged 
        ? editingTrade.savedReturnPercent 
        : calculatedReturnPercent,
      savedRMultiple: editingTrade && !rMultipleFieldsChanged
        ? editingTrade.savedRMultiple
        : (rMultipleCalculated ?? undefined),
      savedRRR: rrrCalculated ?? undefined,
      accountBalanceSnapshot: editingTrade && !pnlFieldsChanged
        ? editingTrade.accountBalanceSnapshot
        : accountBalanceSnapshot,
      contractSize: editingTrade
        ? editingTrade.contractSize
        : (getContractSizeForAccountSymbol(selectedAccountId, symbol.trim())),
      preMfeTickPip: editingTrade ? editingTrade.preMfeTickPip ?? null : null,
      preMaeTickPip: editingTrade ? editingTrade.preMaeTickPip ?? null : null,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
    };

    // Auto-calculate MFE/MAE in tick/pip units (independently) for BOTH new and edited trades
    {
      const trimmedSymbol = symbol.trim();
      const tickSize = getTickSizeForAccountSymbol(selectedAccountId, trimmedSymbol);
      const ep = parseFloat(entryPrice);
      const fpProfit = farthestPriceInProfit !== '' ? parseFloat(farthestPriceInProfit) : NaN;
      const fpLoss = farthestPriceInLoss !== '' ? parseFloat(farthestPriceInLoss) : NaN;
      const canCompute = tickSize && tickSize > 0 && !isNaN(ep);

      // MFE — independent
      if (canCompute && !isNaN(fpProfit)) {
        const profitTicks = direction === 'LONG'
          ? (fpProfit - ep) / tickSize
          : (ep - fpProfit) / tickSize;
        tradeData.preMfeTickPip = Math.max(0, Math.floor(profitTicks));
      } else {
        tradeData.preMfeTickPip = null;
      }

      // MAE — independent
      if (canCompute && !isNaN(fpLoss)) {
        const lossTicks = direction === 'LONG'
          ? (ep - fpLoss) / tickSize
          : (fpLoss - ep) / tickSize;
        tradeData.preMaeTickPip = Math.max(0, Math.floor(lossTicks));
      } else {
        tradeData.preMaeTickPip = null;
      }

      console.log('[MFE/MAE Debug] Saving preMfeTickPip:', tradeData.preMfeTickPip, 'preMaeTickPip:', tradeData.preMaeTickPip);
    }

    if (editingTrade) {
      updateTrade(editingTrade.id, tradeData);
    } else {
      addTrade(tradeData);
    }

    // Auto-register new symbol in settings if it doesn't exist
    const trimmedSymbol = symbol.trim();
    if (trimmedSymbol && !symbolOptions.includes(trimmedSymbol)) {
      setContractSize(trimmedSymbol, 1);
    }

    closeModal();
    resetForm();
  };

  const handleDiscard = () => {
    closeModal();
    resetForm();
  };

  const toggleChecklistItem = (item: string) => {
    setSelectedChecklistItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  // Handle scale in/out modal save
  const handleScaleInOutSave = (
    avgEntry: number, 
    avgExit: number, 
    totalExitQty: number,
    newScaleEntries: ScaleEntry[], 
    newScaleExits: ScaleEntry[],
    openQty: number
  ) => {
    // Persist scale entries and exits
    setScaleEntries(newScaleEntries);
    setScaleExits(newScaleExits);
    // openQuantity is now derived via useMemo from scaleEntries/scaleExits
    
    // Update entry and exit prices with averaged values
    if (avgEntry > 0) {
      setEntryPrice(avgEntry.toFixed(2));
    }
    if (avgExit > 0) {
      setExitPrice(avgExit.toFixed(2));
    }
    // Quantity reflects closed quantity (total exit quantity)
    if (totalExitQty > 0) {
      setQuantity(totalExitQty.toString());
    } else if (newScaleEntries.length > 0) {
      // If no exits, show total entry quantity
      const totalEntryQty = newScaleEntries.reduce((sum, e) => sum + e.quantity, 0);
      setQuantity(totalEntryQty.toString());
    }
  };

  // Calculated summary metrics - Fixed calculations
  const rrrCalculated = useMemo(() => {
    const entry = parseFloat(entryPrice) || 0;
    const sl = stopLoss !== '' ? (parseFloat(stopLoss) || 0) : (calculatedTpSl.sl ?? 0);
    const tp = takeProfit !== '' ? (parseFloat(takeProfit) || 0) : (calculatedTpSl.tp ?? 0);
    
    if (entry <= 0 || sl <= 0 || tp <= 0) return null;
    
    let risk: number;
    let reward: number;
    
    if (direction === 'LONG') {
      risk = entry - sl;
      reward = tp - entry;
    } else {
      risk = sl - entry;
      reward = entry - tp;
    }
    
    // Avoid division by zero
    if (risk <= 0) return null;
    
    return reward / risk;
  }, [entryPrice, stopLoss, takeProfit, direction, calculatedTpSl]);

  const rMultipleCalculated = useMemo(() => {
    const entry = parseFloat(entryPrice) || 0;
    const sl = stopLoss !== '' ? (parseFloat(stopLoss) || 0) : (calculatedTpSl.sl ?? 0);
    const exit = parseFloat(exitPrice) || 0;
    
    // Require exit price for R-Multiple
    if (entry <= 0 || sl <= 0 || exit <= 0) return null;
    
    let risk: number;
    let realizedPnl: number;
    
    if (direction === 'LONG') {
      risk = entry - sl;
      realizedPnl = exit - entry;
    } else {
      risk = sl - entry;
      realizedPnl = entry - exit;
    }
    
    // Avoid division by zero
    if (risk <= 0) return null;
    
    return realizedPnl / risk;
  }, [entryPrice, stopLoss, exitPrice, direction, calculatedTpSl]);

  const returnPercent = displayReturnPercent.toFixed(2) + '%';

  // Checklist dropdown state
  const [checklistOpen, setChecklistOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleDiscard()}>
      <SheetContent 
        side="right" 
          className="w-full sm:max-w-[520px] p-0 flex flex-col bg-background border-l border-border overflow-hidden overflow-x-hidden"
      >
        <TradeModalErrorBoundary>
        {/* Header */}
        <SheetHeader className="px-4 sm:px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-muted-foreground" />
              <SheetTitle className="text-lg font-semibold">
                {editingTrade ? `Edit Trade #${editingTrade.id.slice(0, 7)}` : 'Add Trade'}
              </SheetTitle>
              <Settings2 className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="px-4 sm:px-6 pt-4 flex-shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3 h-10 bg-muted/50">
              <TabsTrigger value="regular" className="text-sm">Regular Data</TabsTrigger>
              <TabsTrigger value="advanced" className="text-sm">Advanced</TabsTrigger>
              <TabsTrigger value="screenshots" className="text-sm">Screenshots</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4">
          {activeTab === 'regular' && (
            <div className="space-y-6">
              {/* General Trade Data Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">General Trade Data</h3>
                
                {/* Account - Required field */}
                <div className="space-y-1.5">
                  <Label className={cn(
                    "text-xs",
                    accountError ? "text-destructive" : "text-muted-foreground"
                  )}>Account *</Label>
                  <Select 
                    value={selectedAccountId || "none"} 
                    onValueChange={(val) => setSelectedAccountId(val === "none" ? "" : val)}
                  >
                    <SelectTrigger className={cn(
                      "h-10 bg-input",
                      accountError 
                        ? "border-destructive ring-1 ring-destructive" 
                        : "border-border"
                    )}>
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Select account...</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {accountError && (
                    <p className="text-xs text-destructive">Please select an account</p>
                  )}
                </div>

                {/* Entry Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Entry Date *</Label>
                  <div className="relative">
                    <Input
                      type="datetime-local"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="h-10 bg-input border-border pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Symbol - Searchable/Creatable Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Symbol *</Label>
                  <TypeableCombobox
                    value={symbol}
                    onChange={setSymbol}
                    options={symbolOptions}
                    onAddNew={(val) => setSymbol(val)}
                    placeholder="e.g., EURUSD, CL, WTI, AAPL..."
                  />
                </div>

                {/* Setup & Checklist - Same Row 50/50 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Setup</Label>
                    <Select value={strategyId || "none"} onValueChange={(val) => setStrategyId(val === "none" ? "" : val)}>
                      <SelectTrigger className="h-10 bg-input border-border">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {strategies.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Checklist Dropdown */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Checklist</Label>
                    <Popover open={checklistOpen} onOpenChange={setChecklistOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={checklistOpen}
                          className="h-10 w-full justify-between bg-input border-border font-normal"
                          disabled={!strategyId || currentStrategyChecklist.length === 0}
                        >
                          <span className="truncate text-sm">
                            {!strategyId ? 'Select setup first' : 
                              currentStrategyChecklist.length === 0 ? 'No items' :
                              selectedChecklistItems.length === 0 ? 'Select items...' :
                              `${selectedChecklistItems.length} of ${currentStrategyChecklist.length} selected`}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0 bg-popover border-border z-50" align="start">
                        <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                          {currentStrategyChecklist.map((item, index) => (
                            <div 
                              key={index} 
                              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                              onClick={() => toggleChecklistItem(item)}
                            >
                              <Checkbox
                                id={`checklist-dropdown-${index}`}
                                checked={selectedChecklistItems.includes(item)}
                                onCheckedChange={() => toggleChecklistItem(item)}
                                className="pointer-events-none"
                              />
                              <label 
                                className="text-sm cursor-pointer flex-1 select-none"
                              >
                                {item}
                              </label>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Direction Section */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Direction *</Label>
                <div className="grid grid-cols-2 gap-0 border border-border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDirection('LONG')}
                    className={cn(
                      "h-10 text-sm font-medium transition-colors",
                      direction === 'LONG'
                        ? "bg-foreground text-background"
                        : "bg-background text-foreground hover:bg-muted/50"
                    )}
                  >
                    Long
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('SHORT')}
                    className={cn(
                      "h-10 text-sm font-medium transition-colors border-l border-border",
                      direction === 'SHORT'
                        ? "bg-foreground text-background"
                        : "bg-background text-foreground hover:bg-muted/50"
                    )}
                  >
                    Short
                  </button>
                </div>
              </div>

              {/* Trade Entry & Exit Side by Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Trade Entry */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Trade Entry</h4>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Entry Price *</Label>
                    <div className="flex gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={entryPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setEntryPrice(val);
                          }
                        }}
                        className="h-10 bg-input border-border flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => setScaleModalOpen(true)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Quantity *</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setQuantity(val);
                        }
                      }}
                      className="h-10 bg-input border-border"
                    />
                    {openQuantity > 0 && (
                      <p className="text-xs text-destructive font-medium">
                        {openQuantity} still open
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Stop Loss</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={calculatedTpSl.sl !== undefined ? calculatedTpSl.sl.toString() : '0.00'}
                      value={stopLoss}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setStopLoss(val);
                        }
                      }}
                      className="h-10 bg-input border-border"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Take Profit</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={calculatedTpSl.tp !== undefined ? calculatedTpSl.tp.toString() : '0.00'}
                      value={takeProfit}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setTakeProfit(val);
                        }
                      }}
                      className="h-10 bg-input border-border"
                    />
                  </div>
                </div>

                {/* Trade Exit */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Trade Exit</h4>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Exit Date</Label>
                    <div className="relative">
                      <Input
                        type="datetime-local"
                        value={exitDate}
                        onChange={(e) => setExitDate(e.target.value)}
                        className="h-10 bg-input border-border pr-10"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Exit Price</Label>
                    <div className="flex gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={exitPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setExitPrice(val);
                          }
                        }}
                        className="h-10 bg-input border-border flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => setScaleModalOpen(true)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Gross P/L - Editable, comes before Net P/L */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Gross P/L</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={grossPnlPlaceholder.toFixed(2)}
                      value={manualGrossPnl}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setManualGrossPnl(val);
                        }
                      }}
                      className="h-10 bg-input border-border"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Net P/L - Read-only, calculated */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Net P/L</Label>
                      <Input
                        type="text"
                        value={`${currencyConfig.symbol}${effectiveNetPnl.toFixed(2)}`}
                        readOnly
                        className="h-10 bg-muted/50 border-border text-muted-foreground text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fees</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={calculatedFee > 0 ? calculatedFee.toFixed(2) : '0.00'}
                        value={fees}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setFees(val);
                          }
                        }}
                        className="h-10 bg-input border-border text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Notes Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">Personal Notes</h4>
                <Textarea
                  placeholder="Add notes about this trade..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px] bg-input border-border resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Trade Comments Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">Trade Comments</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Entry Comments</Label>
                    <TypeableCombobox
                      value={entryComment}
                      onChange={setEntryComment}
                      options={getActiveEntryComments()}
                      onAddNew={addEntryComment}
                      placeholder="Select..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Trade Management</Label>
                    <TypeableCombobox
                      value={tradeManagement}
                      onChange={setTradeManagement}
                      options={getActiveTradeManagements()}
                      onAddNew={addTradeManagement}
                      placeholder="Select..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Exit Comments</Label>
                    <TypeableCombobox
                      value={exitComment}
                      onChange={setExitComment}
                      options={getActiveExitComments()}
                      onAddNew={addExitComment}
                      placeholder="Select..."
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Price Data */}
              <div className="space-y-3">
                <div className="flex items-start gap-1.5">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Price Movement</h4>
                    <p className="text-xs text-muted-foreground">Until Exit</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help mt-0.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-2 text-xs">
                        <div>
                          <p className="font-semibold">MFE — Maximum favorable excursion</p>
                          <p className="text-muted-foreground">Highest price reached before exit</p>
                        </div>
                        <div>
                          <p className="font-semibold">MAE — Maximum adverse excursion</p>
                          <p className="text-muted-foreground">Lowest price reached before exit</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`space-y-1.5 ${openQuantity > 0 ? 'opacity-60' : ''}`}>
                    <Label className="text-xs text-muted-foreground">MFE</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={mfeMaePlaceholder}
                      value={farthestPriceInProfit}
                      disabled={openQuantity > 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setFarthestPriceInProfit(val);
                        }
                      }}
                      className="h-10 bg-input border-border disabled:cursor-not-allowed"
                    />
                    {openQuantity > 0 && (
                      <p className="text-[10px] text-muted-foreground italic">Available after trade is fully closed</p>
                    )}
                  </div>
                  <div className={`space-y-1.5 ${openQuantity > 0 ? 'opacity-60' : ''}`}>
                    <Label className="text-xs text-muted-foreground">MAE</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={mfeMaePlaceholder}
                      value={farthestPriceInLoss}
                      disabled={openQuantity > 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setFarthestPriceInLoss(val);
                        }
                      }}
                      className="h-10 bg-input border-border disabled:cursor-not-allowed"
                    />
                    {openQuantity > 0 && (
                      <p className="text-[10px] text-muted-foreground italic">Available after trade is fully closed</p>
                    )}
                  </div>
                </div>

                {/* After exit (Optional) — visual only, values not persisted */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setAfterExitOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform",
                        afterExitOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                    <span>After exit (Optional)</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info
                          className="w-3.5 h-3.5 text-muted-foreground cursor-help"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <div>
                            <p className="font-semibold">Highest Price</p>
                            <p className="text-muted-foreground">Highest price reached after exit</p>
                          </div>
                          <div>
                            <p className="font-semibold">Lowest Price</p>
                            <p className="text-muted-foreground">Lowest price reached after exit</p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </button>

                  {afterExitOpen && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Highest Price</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={mfeMaePlaceholder}
                          value={afterExitHighest}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setAfterExitHighest(val);
                            }
                          }}
                          className="h-10 bg-input border-border"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Lowest Price</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={mfeMaePlaceholder}
                          value={afterExitLowest}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setAfterExitLowest(val);
                            }
                          }}
                          className="h-10 bg-input border-border"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Level & Break Even Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Price Reached First */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Which level did the price reach first?</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Did the price hit your take profit or stop loss first?</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-2 gap-0 border border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPriceReachedFirst(priceReachedFirst === 'takeProfit' ? '' : 'takeProfit')}
                      className={cn(
                        "h-10 px-4 text-sm font-medium transition-colors",
                        priceReachedFirst === 'takeProfit'
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-muted/50"
                      )}
                    >
                      Take Profit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceReachedFirst(priceReachedFirst === 'stopLoss' ? '' : 'stopLoss')}
                      className={cn(
                        "h-10 px-4 text-sm font-medium transition-colors border-l border-border",
                        priceReachedFirst === 'stopLoss'
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-muted/50"
                      )}
                    >
                      Stop Loss
                    </button>
                  </div>
                </div>

                {/* Break Even */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Break Even</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-0 border border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setBreakEven(breakEven === true ? null : true)}
                      className={cn(
                        "h-10 px-6 text-sm font-medium transition-colors",
                        breakEven === true
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-muted/50"
                      )}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreakEven(breakEven === false ? null : false)}
                      className={cn(
                        "h-10 px-6 text-sm font-medium transition-colors border-l border-border",
                        breakEven === false
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-muted/50"
                      )}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {/* Assign Tags Section */}
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 gap-2"
                  onClick={() => setAssignTagsModalOpen(true)}
                >
                  <Tags className="w-4 h-4" />
                  Assign Tags
                  {selectedTags.length > 0 && (
                    <span className="ml-auto bg-muted px-2 py-0.5 rounded-full text-xs">
                      {selectedTags.length}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'screenshots' && (
            <ScreenshotsTab 
              screenshots={screenshots}
              onScreenshotsChange={setScreenshots}
            />
          )}
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 border-t border-border px-4 sm:px-6 py-3 sm:py-4 bg-background">
          <div className="flex items-center justify-between gap-2">
            {/* Left - Action Buttons */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleSubmit}
                disabled={!canSave}
                className="h-9 px-6 bg-foreground text-background hover:bg-foreground/90"
              >
                Save
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDiscard}
                className="h-9 px-6"
              >
                Cancel
              </Button>
            </div>

            {/* Right - Summary Metrics */}
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Duration
                </p>
                <p className="font-semibold text-xs">{durationFormatted}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">RRR</p>
                <p className="font-semibold">{rrrCalculated !== null ? rrrCalculated.toFixed(1) : '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">R-Multiple</p>
                <p className="font-semibold">{rMultipleCalculated !== null ? rMultipleCalculated.toFixed(2) : '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Return</p>
                <p className="font-semibold">{returnPercent}</p>
              </div>
            </div>
          </div>
        </div>
        </TradeModalErrorBoundary>
      </SheetContent>


      <ScaleInOutModal
        isOpen={scaleModalOpen}
        onClose={() => setScaleModalOpen(false)}
        onSave={handleScaleInOutSave}
        initialEntryPrice={entryPrice}
        initialQuantity={quantity}
        initialExitPrice={exitPrice}
        initialExitQuantity={quantity}
        existingScaleEntries={scaleEntries}
        existingScaleExits={scaleExits}
      />

      {/* Assign Tags Modal */}
      <AssignTagsModal
        isOpen={assignTagsModalOpen}
        onClose={() => setAssignTagsModalOpen(false)}
        selectedTagIds={selectedTags}
        onTagsChange={setSelectedTags}
        symbol={symbol}
        entryDate={entryDate}
      />
    </Sheet>
  );
};
