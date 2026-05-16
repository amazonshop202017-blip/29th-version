import { useMemo } from 'react';
import { isWithinInterval, parseISO, startOfDay, endOfDay, getDay, getHours, getYear } from 'date-fns';
import { useTradesContext } from '@/contexts/TradesContext';
import {
  useGlobalFilters,
  type DayFilter,
  type DirectionFilter,
  type ReturnPercentRange,
} from '@/contexts/GlobalFiltersContext';
import { calculateTradeMetrics, type Trade } from '@/types/trade';

const dayIndexToFilter: Record<number, DayFilter> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

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

/**
 * Returns trades scoped to a single account, with all global filters applied
 * EXCEPT the account filter (which is forcibly locked to `accountId`).
 *
 * This guarantees the consumer never receives trades from other accounts even if
 * the user changes the global account filter.
 */
export const useAccountScopedFilteredTrades = (accountId: string | undefined): Trade[] => {
  const { trades } = useTradesContext();
  const {
    dateRange,
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
    positionSizeMin,
    positionSizeMax,
    selectedYear,
    selectedChecklistItems,
    excludedChecklistItems,
    selectedTagsByCategory,
    selectedTradeComments,
    classifyTradeOutcome,
  } = useGlobalFilters();

  return useMemo(() => {
    if (!accountId) return [];

    // STRICT account scope — never include trades from any other account.
    let filtered = trades.filter((t) => t.accountId === accountId);

    // Date range
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter((trade) => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        const tradeDate = parseISO(metrics.openDate);
        const from = dateRange.from ? startOfDay(dateRange.from) : new Date(0);
        const to = dateRange.to ? endOfDay(dateRange.to) : new Date(9999, 11, 31);
        return isWithinInterval(tradeDate, { start: from, end: to });
      });
    }

    // Symbol
    if (selectedSymbols.length > 0) {
      filtered = filtered.filter((trade) => selectedSymbols.includes(trade.symbol));
    }

    // Outcome
    if (selectedOutcomes.length > 0) {
      filtered = filtered.filter((trade) => {
        const metrics = calculateTradeMetrics(trade);
        const outcome = classifyTradeOutcome(metrics.netPnl, trade.savedReturnPercent, trade.breakEven);
        return selectedOutcomes.includes(outcome);
      });
    }

    // Hour
    if (selectedHours.length > 0) {
      filtered = filtered.filter((trade) => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        return selectedHours.includes(getHours(parseISO(metrics.openDate)));
      });
    }

    // Setup (strategyId)
    if (selectedSetups.length > 0) {
      filtered = filtered.filter((trade) => trade.strategyId && selectedSetups.includes(trade.strategyId));
    }

    // Exclude setups
    if (excludedSetups.length > 0) {
      filtered = filtered.filter((trade) => !trade.strategyId || !excludedSetups.includes(trade.strategyId));
    }

    // Day of week
    if (selectedDays.length > 0) {
      filtered = filtered.filter((trade) => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        const dayFilter = dayIndexToFilter[getDay(parseISO(metrics.openDate))];
        return selectedDays.includes(dayFilter);
      });
    }

    // Direction
    if (selectedDirections.length > 0) {
      filtered = filtered.filter((trade) => {
        const tradeSide = trade.side?.toLowerCase() as DirectionFilter;
        return selectedDirections.includes(tradeSide);
      });
    }

    // Return % ranges
    if (selectedReturnRanges.length > 0) {
      filtered = filtered.filter((trade) =>
        selectedReturnRanges.some((range) => matchesReturnRange(trade.savedReturnPercent, range))
      );
    }

    // R-Multiple Min/Max (inclusive)
    if (rMultipleMin !== null || rMultipleMax !== null) {
      filtered = filtered.filter((trade) => {
        const r = trade.savedRMultiple;
        if (r === undefined || r === null) return false;
        if (rMultipleMin !== null && r < rMultipleMin) return false;
        if (rMultipleMax !== null && r > rMultipleMax) return false;
        return true;
      });
    }

    // Position Size Min/Max (inclusive, qty)
    if (positionSizeMin !== null || positionSizeMax !== null) {
      filtered = filtered.filter((trade) => {
        const qty = calculateTradeMetrics(trade).totalQuantity;
        if (qty === undefined || qty === null) return false;
        if (positionSizeMin !== null && qty < positionSizeMin) return false;
        if (positionSizeMax !== null && qty > positionSizeMax) return false;
        return true;
      });
    }

    // Year
    if (selectedYear !== null) {
      filtered = filtered.filter((trade) => {
        const metrics = calculateTradeMetrics(trade);
        if (!metrics.openDate) return false;
        return getYear(parseISO(metrics.openDate)) === selectedYear;
      });
    }

    // Checklist items (AND)
    if (selectedChecklistItems.length > 0) {
      filtered = filtered.filter((trade) => {
        const tradeChecklist = trade.selectedChecklistItems || [];
        return selectedChecklistItems.every((item) => tradeChecklist.includes(item));
      });
    }

    if (excludedChecklistItems.length > 0) {
      filtered = filtered.filter((trade) => {
        const tradeChecklist = trade.selectedChecklistItems || [];
        return !excludedChecklistItems.some((item) => tradeChecklist.includes(item));
      });
    }

    // Tags (AND across categories, OR within category)
    const activeCategoryIds = Object.keys(selectedTagsByCategory).filter(
      (categoryId) => selectedTagsByCategory[categoryId]?.length > 0
    );
    if (activeCategoryIds.length > 0) {
      filtered = filtered.filter((trade) =>
        activeCategoryIds.every((categoryId) => {
          const selectedTagIds = selectedTagsByCategory[categoryId];
          return selectedTagIds.some((tagId) => trade.tags?.includes(tagId));
        })
      );
    }

    // Trade comments
    if (selectedTradeComments.entryComments.length > 0) {
      filtered = filtered.filter(
        (trade) => trade.entryComment && selectedTradeComments.entryComments.includes(trade.entryComment)
      );
    }
    if (selectedTradeComments.tradeManagements.length > 0) {
      filtered = filtered.filter(
        (trade) => trade.tradeManagement && selectedTradeComments.tradeManagements.includes(trade.tradeManagement)
      );
    }
    if (selectedTradeComments.exitComments.length > 0) {
      filtered = filtered.filter(
        (trade) => trade.exitComment && selectedTradeComments.exitComments.includes(trade.exitComment)
      );
    }

    // Last N trades — applied last
    if (lastTradesFilter !== null) {
      const sorted = [...filtered].sort((a, b) => {
        const aMetrics = calculateTradeMetrics(a);
        const bMetrics = calculateTradeMetrics(b);
        const aDate = aMetrics.openDate ? parseISO(aMetrics.openDate).getTime() : 0;
        const bDate = bMetrics.openDate ? parseISO(bMetrics.openDate).getTime() : 0;
        return bDate - aDate;
      });
      filtered = sorted.slice(0, lastTradesFilter);
    }

    return filtered;
  }, [
    trades,
    accountId,
    dateRange,
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
    positionSizeMin,
    positionSizeMax,
    selectedYear,
    selectedChecklistItems,
    excludedChecklistItems,
    selectedTagsByCategory,
    selectedTradeComments,
    classifyTradeOutcome,
  ]);
};
