import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { Trade, TradeFormData, calculateTradeMetrics } from '@/types/trade';
import { useGlobalFilters, OutcomeFilter, DayFilter, DirectionFilter, ReturnPercentRange, RMultipleRange, TagFilters, TradeCommentFilters, TradeCommentCategory } from '@/contexts/GlobalFiltersContext';
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

// Helper function to check if R-Multiple falls within a range
const matchesRMultipleRange = (rMultiple: number | undefined, range: RMultipleRange): boolean => {
  if (rMultiple === undefined) return false;
  switch (range) {
    case '<-2': return rMultiple < -2;
    case '-2-0': return rMultiple >= -2 && rMultiple < 0;
    case '0-1': return rMultiple >= 0 && rMultiple < 1;
    case '1-2': return rMultiple >= 1 && rMultiple < 2;
    case '2-4': return rMultiple >= 2 && rMultiple < 4;
    case '>4': return rMultiple >= 4;
    default: return false;
  }
};

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
export const useFilteredTradesContext = (activeAccountIds?: string[]) => {
  const { trades, addTrade, bulkAddTrades, updateTrade, bulkUpdateTrades, deleteTrade, deleteTrades, deleteTradesByAccountId, getTradeById } = useTradesContext();
  const { 
    dateRange, 
    selectedAccounts,
    selectedSymbols,
    selectedOutcomes,
    selectedHours,
    selectedSetups,
    selectedDays,
    lastTradesFilter,
    selectedDirections,
    selectedReturnRanges,
    selectedRMultipleRanges,
    selectedYear,
    selectedChecklistItems,
    selectedTagsByCategory,
    selectedTradeComments,
    classifyTradeOutcome,
  } = useGlobalFilters();

  // Use provided activeAccountIds or default to empty (show all if not provided)
  const accountIds = activeAccountIds || [];

  const filteredTrades = useMemo(() => {
    let filtered = trades;

    // When "All Accounts" is selected (selectedAccounts is empty), 
    // filter to only include trades from ACTIVE (non-archived) accounts
    if (selectedAccounts.length === 0) {
      if (accountIds.length > 0) {
        filtered = filtered.filter(trade => 
          accountIds.includes(trade.accountId)
        );
      }
    } else {
      // Filter by specifically selected accounts (UUIDs)
      filtered = filtered.filter(trade => 
        selectedAccounts.includes(trade.accountId)
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

    // Filter by setup (strategyId)
    if (selectedSetups.length > 0) {
      filtered = filtered.filter(trade => 
        trade.strategyId && selectedSetups.includes(trade.strategyId)
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

    // Filter by R-Multiple ranges
    if (selectedRMultipleRanges.length > 0) {
      filtered = filtered.filter(trade => {
        const rMultiple = trade.savedRMultiple;
        // Match if trade falls within ANY of the selected ranges (OR logic)
        return selectedRMultipleRanges.some(range => matchesRMultipleRange(rMultiple, range));
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
  }, [trades, dateRange, selectedAccounts, accountIds, selectedSymbols, selectedOutcomes, selectedHours, selectedSetups, selectedDays, lastTradesFilter, selectedDirections, selectedReturnRanges, selectedRMultipleRanges, selectedYear, selectedChecklistItems, selectedTagsByCategory, selectedTradeComments, classifyTradeOutcome]);

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
