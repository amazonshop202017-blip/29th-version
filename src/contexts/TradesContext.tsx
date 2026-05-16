import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { Trade, TradeFormData, calculateTradeMetrics } from '@/types/trade';
import { useGlobalFilters, OutcomeFilter, DayFilter, DirectionFilter, ReturnPercentRange, TagFilters, TradeCommentFilters, TradeCommentCategory, TimeInterval } from '@/contexts/GlobalFiltersContext';
// NOTE: useAccountsContext is imported dynamically to avoid circular dependency
// AccountsContext imports TradesContext, so we can't import AccountsContext here at module level
import { isWithinInterval, parseISO, startOfDay, endOfDay, getDay, getHours, getYear } from 'date-fns';

// Helper function to check if return % falls within a range
const matchesReturnRange = (returnPercent: number | undefined, range: ReturnPercentRange): boolean => {
  if (returnPercent === undefined) return false;
  switch (range) {
    case '<0': return returnPercent < 0;
    case '0-1': return returnPercent >= 0 && returnPercent < 1;
    case '1-2': return returnPercent >= 1 && returnPercent < 2;
    case '3-5': return returnPercent >= 3 && returnPercent < 5;
    case '5-10': return returnPercent >= 5 && returnPercent < 10;
    case '>10': return returnPercent >= 10;
    default: return false;
  }
};

// Helper: does the time-of-day (in minutes) match any of the provided intervals?
// Intervals with empty min OR max are ignored. Wrap-around (min > max) supported.
const matchesTimeIntervals = (minutesOfDay: number, intervals: TimeInterval[]): boolean => {
  const toMinutes = (s: string | null): number | null => {
    if (!s) return null;
    const [h, m] = s.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };
  const valid = intervals
    .map(({ min, max }) => {
      const mn = toMinutes(min);
      const mx = toMinutes(max);
      if (mn === null && mx === null) return null;
      // If only one side provided, default the other: min->00:00, max->23:59
      return { min: mn ?? 0, max: mx ?? 23 * 60 + 59 };
    })
    .filter((i): i is { min: number; max: number } => i !== null);
  if (valid.length === 0) return true; // no active intervals -> pass-through
  return valid.some(({ min, max }) => {
    if (min <= max) return minutesOfDay >= min && minutesOfDay <= max;
    // wrap around midnight
    return minutesOfDay >= min || minutesOfDay <= max;
  });
};
const hasActiveIntervals = (intervals: TimeInterval[]) =>
  intervals.some(i => i.min || i.max);

// Helper function to check if R-Multiple falls within a range
interface TradesContextType {
  trades: Trade[]; // All trades (unfiltered)
  filteredTrades: Trade[]; // Trades after applying global filters
  stats: {
    netPnl: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakevenTrades: number;
    tradeWinRate: number;
    dayWinRate: number;
    winningDays: number;
    losingDays: number;
    breakevenDays: number;
    avgWin: number;
    avgLoss: number;
    totalProfits: number;
    totalLosses: number;
    profitFactor: number;
  };
  addTrade: (data: TradeFormData) => Trade;
  bulkAddTrades: (tradesData: TradeFormData[]) => Trade[];
  updateTrade: (id: string, data: TradeFormData) => void;
  bulkUpdateTrades: (updates: Map<string, Partial<TradeFormData>>) => void;
  deleteTrade: (id: string) => void;
  deleteTrades: (ids: string[]) => void;
  deleteTradesByAccountId: (accountId: string) => void;
  getTradeById: (id: string) => Trade | undefined;
  toggleStarred: (id: string) => void;
}

const TradesContext = createContext<TradesContextType | undefined>(undefined);

export const TradesProvider = ({ children }: { children: ReactNode }) => {
  const tradesHook = useTrades();
  
  // We can't use useGlobalFilters here because GlobalFiltersProvider is nested inside TradesProvider
  // Instead, we'll provide both filtered and unfiltered trades

  return (
    <TradesContext.Provider value={{
      ...tradesHook,
      filteredTrades: tradesHook.trades, // Will be overridden by FilteredTradesProvider
    }}>
      {children}
    </TradesContext.Provider>
  );
};

export const useTradesContext = (): TradesContextType => {
  const context = useContext(TradesContext);
  if (context === undefined) {
    throw new Error('useTradesContext must be used within TradesProvider');
  }
  // Provide default implementations for new methods if they don't exist
  return {
    ...context,
    deleteTradesByAccountId: context.deleteTradesByAccountId || (() => {}),
    deleteTrades: context.deleteTrades || ((ids: string[]) => ids.forEach(context.deleteTrade)),
  };
};

// Map day index (0-6, Sunday=0) to DayFilter
const dayIndexToFilter: Record<number, DayFilter> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

// Hook to get filtered trades and stats (must be used inside GlobalFiltersProvider)
// NOTE: activeAccountIds is passed as a parameter to avoid circular dependency with AccountsContext
export const useFilteredTradesContext = (
  activeAccountIds?: string[],
  extraTrades: Trade[] = [],
) => {
  const { trades, addTrade, bulkAddTrades, updateTrade, bulkUpdateTrades, deleteTrade, deleteTrades, deleteTradesByAccountId, getTradeById } = useTradesContext();
  const { 
    dateRange, 
    selectedAccounts,
    selectedSymbols,
    selectedOutcomes,
    selectedHours,
    selectedSetups,
    excludedSetups,
    selectedDays,
    lastTradesFilter,
    selectedDirections,
    selectedReturnRanges,
    rMultipleMin,
    rMultipleMax,
    holdingPeriodFilter,
    positionSizeMin,
    positionSizeMax,
    selectedYear,
    durationMinutesMin,
    durationMinutesMax,
    entryTimeIntervals,
    exitTimeIntervals,
    selectedChecklistItems,
    excludedChecklistItems,
    selectedTagsByCategory,
    selectedTradeComments,
    classifyTradeOutcome,
    starredFilter,
  } = useGlobalFilters();

  // Use provided activeAccountIds or default to empty (show all if not provided).
  // Extra trades carry their own (e.g. backtesting) account ids that must be
  // recognized as "active" so they survive the activeSet filter below.
  const extraAccountIds = useMemo(
    () => Array.from(new Set(extraTrades.map(t => t.accountId))),
    [extraTrades],
  );
  const accountIds = useMemo(
    () => [...(activeAccountIds || []), ...extraAccountIds],
    [activeAccountIds, extraAccountIds],
  );

  const filteredTrades = useMemo(() => {
    let filtered: Trade[] = extraTrades.length > 0 ? [...trades, ...extraTrades] : trades;

    // Archived accounts must NEVER be included in analytics, regardless of selection.
    // If there are zero active accounts, the result is zero trades (not all trades).
    const activeSet = new Set(accountIds);
    if (selectedAccounts.length === 0) {
      // "All accounts" = all ACTIVE (non-archived) accounts only.
      filtered = filtered.filter(trade => activeSet.has(trade.accountId));
    } else {
      // Explicit selection — intersect with active accounts so archived selections drop out.
      const selectedSet = new Set(selectedAccounts);
      filtered = filtered.filter(trade =>
        selectedSet.has(trade.accountId) && activeSet.has(trade.accountId)
      );
    }

    // Filter by date range
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        
        const tradeDate = parseISO(metrics.openDate);
        const from = dateRange.from ? startOfDay(dateRange.from) : new Date(0);
        const to = dateRange.to ? endOfDay(dateRange.to) : new Date(9999, 11, 31);
        
        return isWithinInterval(tradeDate, { start: from, end: to });
      });
    }

    // Filter by symbol
    if (selectedSymbols.length > 0) {
      filtered = filtered.filter(trade => 
        selectedSymbols.includes(trade.symbol)
      );
    }

    // Filter by outcome (using global breakeven tolerance)
    if (selectedOutcomes.length > 0) {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        const outcome = classifyTradeOutcome(metrics.netPnl, trade.savedReturnPercent, trade.breakEven);
        return selectedOutcomes.includes(outcome);
      });
    }

    // Filter by hour (entry hour)
    if (selectedHours.length > 0) {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        
        const entryDate = parseISO(metrics.openDate);
        const entryHour = getHours(entryDate);
        return selectedHours.includes(entryHour);
      });
    }

    // Entry time intervals
    if (hasActiveIntervals(entryTimeIntervals)) {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        const d = parseISO(metrics.openDate);
        return matchesTimeIntervals(d.getHours() * 60 + d.getMinutes(), entryTimeIntervals);
      });
    }

    // Exit time intervals
    if (hasActiveIntervals(exitTimeIntervals)) {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.closeDate) return false;
        const d = parseISO(metrics.closeDate);
        return matchesTimeIntervals(d.getHours() * 60 + d.getMinutes(), exitTimeIntervals);
      });
    }

    // Starred filter
    if (starredFilter === 'starred') {
      filtered = filtered.filter(trade => trade.starred === true);
    } else if (starredFilter === 'unstarred') {
      filtered = filtered.filter(trade => !trade.starred);
    }

    // Filter by setup (strategyId)
    if (selectedSetups.length > 0) {
      filtered = filtered.filter(trade => 
        trade.strategyId && selectedSetups.includes(trade.strategyId)
      );
    }

    // Exclude setups: remove trades whose strategyId is in excludedSetups
    if (excludedSetups.length > 0) {
      filtered = filtered.filter(trade =>
        !trade.strategyId || !excludedSetups.includes(trade.strategyId)
      );
    }

    // Filter by day of week (entry day)
    if (selectedDays.length > 0) {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        
        const entryDate = parseISO(metrics.openDate);
        const dayIndex = getDay(entryDate);
        const dayFilter = dayIndexToFilter[dayIndex];
        return selectedDays.includes(dayFilter);
      });
    }

    // Filter by direction (Long/Short)
    if (selectedDirections.length > 0) {
      filtered = filtered.filter(trade => {
        const tradeSide = trade.side?.toLowerCase() as DirectionFilter;
        return selectedDirections.includes(tradeSide);
      });
    }

    // Filter by Return % ranges
    if (selectedReturnRanges.length > 0) {
      filtered = filtered.filter(trade => {
        const returnPercent = trade.savedReturnPercent;
        // Match if trade falls within ANY of the selected ranges (OR logic)
        return selectedReturnRanges.some(range => matchesReturnRange(returnPercent, range));
      });
    }

    // Filter by R-Multiple Min/Max (inclusive bounds)
    if (rMultipleMin !== null || rMultipleMax !== null) {
      filtered = filtered.filter(trade => {
        const r = trade.savedRMultiple;
        if (r === undefined || r === null) return false;
        if (rMultipleMin !== null && r < rMultipleMin) return false;
        if (rMultipleMax !== null && r > rMultipleMax) return false;
        return true;
      });
    }

    // Filter by Position Size Min/Max (inclusive bounds, qty)
    if (positionSizeMin !== null || positionSizeMax !== null) {
      filtered = filtered.filter(trade => {
        const qty = calculateTradeMetrics(trade).totalQuantity;
        if (qty === undefined || qty === null) return false;
        if (positionSizeMin !== null && qty < positionSizeMin) return false;
        if (positionSizeMax !== null && qty > positionSizeMax) return false;
        return true;
      });
    }

    // Filter by Holding Period (Intraday / Multiday)
    if (holdingPeriodFilter !== 'all') {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate || !metrics.closeDate) return false;
        const open = parseISO(metrics.openDate);
        const close = parseISO(metrics.closeDate);
        const sameDay =
          open.getFullYear() === close.getFullYear() &&
          open.getMonth() === close.getMonth() &&
          open.getDate() === close.getDate();
        return holdingPeriodFilter === 'intraday' ? sameDay : !sameDay;
      });
    }

    // Filter by Duration (minutes) min/max
    if (durationMinutesMin !== null || durationMinutesMax !== null) {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        if (metrics.positionStatus !== 'CLOSED' || !metrics.durationMinutes) return false;
        const d = metrics.durationMinutes;
        if (durationMinutesMin !== null && d < durationMinutesMin) return false;
        if (durationMinutesMax !== null && d > durationMinutesMax) return false;
        return true;
      });
    }

    // Filter by Year
    if (selectedYear !== null) {
      filtered = filtered.filter(trade => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        const tradeYear = getYear(parseISO(metrics.openDate));
        return tradeYear === selectedYear;
      });
    }

    // Filter by Checklist Items (AND logic - trade must have ALL selected checklist items)
    if (selectedChecklistItems.length > 0) {
      filtered = filtered.filter(trade => {
        // Trade must have the selected checklist items ticked
        const tradeChecklist = trade.selectedChecklistItems || [];
        return selectedChecklistItems.every(item => tradeChecklist.includes(item));
      });
    }

    // Exclude trades that have ANY of the excluded checklist items ticked
    if (excludedChecklistItems.length > 0) {
      filtered = filtered.filter(trade => {
        const tradeChecklist = trade.selectedChecklistItems || [];
        return !excludedChecklistItems.some(item => tradeChecklist.includes(item));
      });
    }

    // Filter by Tags (AND across categories, OR within category)
    const activeCategoryIds = Object.keys(selectedTagsByCategory).filter(
      categoryId => selectedTagsByCategory[categoryId]?.length > 0
    );
    
    if (activeCategoryIds.length > 0) {
      filtered = filtered.filter(trade => {
        // Trade must match at least one tag from EACH active category (AND logic)
        return activeCategoryIds.every(categoryId => {
          const selectedTagIds = selectedTagsByCategory[categoryId];
          // Within a category, trade matches if it has at least one of the selected tags (OR logic)
          return selectedTagIds.some(tagId => trade.tags?.includes(tagId));
        });
      });
    }

    // Filter by Trade Comments (AND across categories)
    // Entry Comments filter
    if (selectedTradeComments.entryComments.length > 0) {
      filtered = filtered.filter(trade => 
        trade.entryComment && selectedTradeComments.entryComments.includes(trade.entryComment)
      );
    }
    
    // Trade Management Comments filter
    if (selectedTradeComments.tradeManagements.length > 0) {
      filtered = filtered.filter(trade => 
        trade.tradeManagement && selectedTradeComments.tradeManagements.includes(trade.tradeManagement)
      );
    }
    
    // Exit Comments filter
    if (selectedTradeComments.exitComments.length > 0) {
      filtered = filtered.filter(trade => 
        trade.exitComment && selectedTradeComments.exitComments.includes(trade.exitComment)
      );
    }

    // Apply "Last Trades" filter LAST - take most recent N trades after all other filters
    if (lastTradesFilter !== null) {
      // Sort by entry date descending
      const sorted = [...filtered].sort((a, b) => {
        const aMetrics = calculateTradeMetrics(a);
        const bMetrics = calculateTradeMetrics(b);
        const aDate = aMetrics.openDate ? parseISO(aMetrics.openDate).getTime() : 0;
        const bDate = bMetrics.openDate ? parseISO(bMetrics.openDate).getTime() : 0;
        return bDate - aDate; // Descending
      });
      filtered = sorted.slice(0, lastTradesFilter);
    }

    return filtered;
  }, [trades, extraTrades, dateRange, selectedAccounts, accountIds, selectedSymbols, selectedOutcomes, selectedHours, selectedSetups, excludedSetups, selectedDays, lastTradesFilter, selectedDirections, selectedReturnRanges, rMultipleMin, rMultipleMax, positionSizeMin, positionSizeMax, holdingPeriodFilter, durationMinutesMin, durationMinutesMax, entryTimeIntervals, exitTimeIntervals, selectedYear, selectedChecklistItems, excludedChecklistItems, selectedTagsByCategory, selectedTradeComments, classifyTradeOutcome, starredFilter]);

  const stats = useMemo(() => {
    // Classify trades using breakeven tolerance (pass trade-level isBreakeven flag)
    const classifiedTrades = filteredTrades.map(t => {
      const metrics = calculateTradeMetrics(t);
      const outcome = classifyTradeOutcome(metrics.netPnl, t.savedReturnPercent, t.breakEven);
      return { trade: t, metrics, outcome };
    });
    
    const winningTrades = classifiedTrades.filter(({ outcome }) => outcome === 'win');
    const losingTrades = classifiedTrades.filter(({ outcome }) => outcome === 'loss');
    const breakevenTrades = classifiedTrades.filter(({ outcome }) => outcome === 'breakeven');
    
    const totalProfits = winningTrades.reduce((sum, { metrics }) => sum + metrics.netPnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, { metrics }) => sum + metrics.netPnl, 0));
    
    // Calculate day-based stats using trade-level outcomes (not aggregated P/L)
    // Day classification rules:
    // 1. If ALL trades on a day are Breakeven → Breakeven Day
    // 2. If day has Wins and NO Losses → Win Day
    // 3. If day has Losses and NO Wins → Loss Day
    // 4. If day has both Wins and Losses → Loss Day (loss dominance)
    const dayTradeOutcomes = classifiedTrades.reduce((acc, { metrics, outcome }) => {
      const day = metrics.closeDate ? metrics.closeDate.split('T')[0] : 'unknown';
      if (!acc[day]) {
        acc[day] = { wins: 0, losses: 0, breakevens: 0 };
      }
      if (outcome === 'win') acc[day].wins += 1;
      else if (outcome === 'loss') acc[day].losses += 1;
      else acc[day].breakevens += 1;
      return acc;
    }, {} as Record<string, { wins: number; losses: number; breakevens: number }>);
    
    // Classify each day based on its trade outcomes
    let winningDaysCount = 0;
    let losingDaysCount = 0;
    let breakevenDaysCount = 0;
    
    Object.values(dayTradeOutcomes).forEach(dayStats => {
      const { wins, losses, breakevens } = dayStats;
      const totalTradesOnDay = wins + losses + breakevens;
      
      if (breakevens === totalTradesOnDay) {
        // All trades are breakeven → Breakeven Day
        breakevenDaysCount += 1;
      } else if (losses > 0) {
        // Has any losses → Loss Day (loss dominance)
        losingDaysCount += 1;
      } else if (wins > 0) {
        // Has wins and NO losses → Win Day
        winningDaysCount += 1;
      }
    });
    
    // Win Rate = Wins / (Wins + Losses) - excludes breakeven trades
    const winsAndLosses = winningTrades.length + losingTrades.length;
    const tradeWinRate = winsAndLosses > 0 
      ? (winningTrades.length / winsAndLosses) * 100 
      : 0;
    
    // Day Win Rate = Winning Days / (Winning + Losing Days) - excludes breakeven days
    const winAndLoseDays = winningDaysCount + losingDaysCount;
    const dayWinRate = winAndLoseDays > 0 
      ? (winningDaysCount / winAndLoseDays) * 100 
      : 0;
    
    return {
      netPnl: filteredTrades.reduce((sum, t) => sum + calculateTradeMetrics(t).netPnl, 0),
      totalTrades: filteredTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      breakevenTrades: breakevenTrades.length,
      tradeWinRate,
      dayWinRate,
      winningDays: winningDaysCount,
      losingDays: losingDaysCount,
      breakevenDays: breakevenDaysCount,
      avgWin: winningTrades.length > 0 
        ? totalProfits / winningTrades.length 
        : 0,
      avgLoss: losingTrades.length > 0 
        ? -(totalLosses / losingTrades.length) 
        : 0,
      totalProfits,
      totalLosses,
      profitFactor: totalLosses > 0 ? totalProfits / totalLosses : (totalProfits > 0 ? Infinity : 0),
    };
  }, [filteredTrades, classifyTradeOutcome]);

  return {
    trades,
    filteredTrades,
    stats,
    addTrade,
    bulkAddTrades,
    updateTrade,
    bulkUpdateTrades,
    deleteTrade,
    deleteTrades,
    deleteTradesByAccountId,
    getTradeById,
  };
};
