import {
  useMemo, useState } from 'react';
import {
  useFilteredTrades } from '@/hooks/useFilteredTrades';
import {
  useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import {
  useAccountsContext } from '@/contexts/AccountsContext';
import {
  useTagsContext } from '@/contexts/TagsContext';
import {
  usePrivacyMode } from '@/hooks/usePrivacyMode';
import {
  calculateTradeMetrics, Trade } from '@/types/trade';
import {
  ChartDisplayType, mapGlobalToChartDisplay, formatDuration, formatDurationTick } from '@/hooks/useChartDisplayMode';
import {
  buildGroupDailyCounts, getGroupTradingActivityStats } from '@/lib/tradingActivityStats';
import {
  buildGroupedTradesMap, getGroupRiskDrawdownStats } from '@/lib/riskDrawdownStats';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
  Legend,
  Customized,
} from 'recharts';
import { ChartGradientDefs, useGradientFill } from '@/components/charts/ChartGradientDefs';
import {
  Card, CardContent } from '@/components/ui/card';
import {
  ChartDisplayDropdown } from './ChartDisplayDropdown';
import { ChartMetricSettingsPopover, MetricConfig } from './ChartMetricSettingsPopover';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { getDisplayLabel } from '@/hooks/useChartDisplayMode';

const DEFAULT_METRIC_COLORS = [
  'hsl(var(--chart-1))'  ,
  'hsl(var(--profit))'  ,
  'hsl(45 93% 47%)'  ,
];

const getMetricValue = (data: GroupedData, metric: ChartDisplayType): number => {
  switch (metric) {
    case 'dollar': return data.totalPnl;
    case 'percent': return data.totalPercent;
    case 'winrate': return data.winrate;
    case 'tradecount': return data.tradeCount;
    case 'avg_hold_time': return data.avgHoldTimeMinutes;
    case 'longest_duration': return data.longestDurationMinutes;
    case 'long_winrate': return data.longWinrate;
    case 'short_winrate': return data.shortWinrate;
    case 'tradecount_long': return data.longTradeCount;
    case 'tradecount_short': return data.shortTradeCount;
    case 'avg_win': return data.avgWin;
    case 'avg_loss': return data.avgLoss;
    case 'largest_win': return data.largestWin;
    case 'largest_loss': return data.largestLoss;
    case 'profit_factor': return data.profitFactor;
    case 'trade_expectancy': return data.tradeExpectancy;
    case 'avg_net_trade_pnl': return data.avgNetTradePnl;
    default: return data.totalPnl;
  }
};

type SelectionType = 'tradeComments' | 'tags';
type CommentCategory = 'entryComments' | 'tradeManagement' | 'exitComments';

interface GroupedData {
  name: string;
  totalPnl: number;
  totalPercent: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  avgPnl: number;
  winrate: number;
  displayValue: number;
  avgHoldTimeMinutes: number;
  longestDurationMinutes: number;
  longWinCount: number;
  longLossCount: number;
  longWinrate: number;
  shortWinCount: number;
  shortLossCount: number;
  shortWinrate: number;
  longTradeCount: number;
  shortTradeCount: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  winPnlSum: number;
  lossPnlSum: number;
  // Trading Activity stats
  avgTradesPerDay: number;
  medianTradesPerDay: number;
  percentile90TradesPerDay: number;
  maxTradesInDay: number;
  loggedDays: number;
  // Profitability metrics
  profitFactor: number;
  tradeExpectancy: number;
  avgNetTradePnl: number;
  grossProfit: number;
  grossLoss: number;
  // Risk & Drawdown metrics
  avgRealizedR: number;
  avgPlannedR: number;
  avgDailyDrawdown: number;
  largestDailyLoss: number;
  largestDailyLossDate: string;
  losingDaysCount: number;
  winningDaysCount: number;
  breakevenDaysCount: number;
  tradesWithRealizedR: number;
  tradesWithPlannedR: number;
}

interface TagsCommentsChartProps {
  selectionType: SelectionType;
  selectedCommentCategory: CommentCategory;
  selectedTagIds: string[];
  defaultDisplayType?: ChartDisplayType;
  useGlobalDefault?: boolean;
}

export const TagsCommentsChart = ({
  selectionType,
  selectedCommentCategory,
  selectedTagIds,
  defaultDisplayType = 'dollar',
  useGlobalDefault = true,
}: TagsCommentsChartProps) => {
  const { filteredTrades } = useFilteredTrades();
  const { currencyConfig, selectedAccounts, isAllAccountsSelected, classifyTradeOutcome, displayMode, breakevenTolerance } = useGlobalFilters();
  const { accounts, getAccountBalanceBeforeTrades } = useAccountsContext();
  const { tags } = useTagsContext();
  const { isPrivacyMode } = usePrivacyMode();
  const { getFill, primaryFill } = useGradientFill('tagsComments');

  // Calculate initial display type from global filter or prop
  const getInitialDisplayType = (): ChartDisplayType => {
    if (useGlobalDefault) {
      return mapGlobalToChartDisplay(displayMode);
    }
    return defaultDisplayType;
  };

  const [selectedMetrics, setSelectedMetrics] = useState<ChartDisplayType[]>([getInitialDisplayType()]);
  const [metricConfigs, setMetricConfigs] = useState<MetricConfig[]>([
    { type: 'column', color: DEFAULT_METRIC_COLORS[0] }
  ]);
  const displayType = selectedMetrics[0];
  const getMetricColor = (index: number) => metricConfigs[index]?.color || DEFAULT_METRIC_COLORS[index] || DEFAULT_METRIC_COLORS[0];
  const updateMetricConfig = (index: number, partial: Partial<MetricConfig>) => {
    setMetricConfigs(prev => { const next = [...prev]; next[index] = { ...next[index], ...partial }; return next; });
  };
  const addMetric = () => {
    if (selectedMetrics.length >= 3) return;
    const allOptions: ChartDisplayType[] = ['dollar', 'winrate', 'tradecount', 'percent'];
    const next = allOptions.find(m => !selectedMetrics.includes(m)) || 'dollar';
    setSelectedMetrics(prev => [...prev, next]);
    setMetricConfigs(prev => [...prev, { type: 'column', color: DEFAULT_METRIC_COLORS[prev.length] || DEFAULT_METRIC_COLORS[0] }]);
  };
  const removeMetric = (index: number) => {
    setSelectedMetrics(prev => prev.filter((_, i) => i !== index));
    setMetricConfigs(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate total starting balance
  const totalStartingBalance = useMemo(() => {
    const activeAccounts = accounts.filter(a => !a.isArchived);
    if (isAllAccountsSelected) {
      return activeAccounts.reduce((sum, acc) => sum + getAccountBalanceBeforeTrades(acc.id), 0);
    } else if (selectedAccounts.length > 0) {
      return activeAccounts
        .filter(acc => selectedAccounts.includes(acc.name))
        .reduce((sum, acc) => sum + getAccountBalanceBeforeTrades(acc.id), 0);
    }
    return 0;
  }, [accounts, selectedAccounts, isAllAccountsSelected, getAccountBalanceBeforeTrades]);

  // Calculate grouped data based on selection
  const groupedData = useMemo(() => {
    // Include all trades for trading activity stats
    const allTrades = filteredTrades;
    const closedTrades = filteredTrades.filter((trade: Trade) => {
      const metrics = calculateTradeMetrics(trade);
      return metrics.positionStatus === 'CLOSED';
    });

    if (closedTrades.length === 0) return [];

    // Build grouped trades map for Risk & Drawdown calculations
    const groupedTradesMap = buildGroupedTradesMap(closedTrades, (trade) => {
      if (selectionType === 'tradeComments') {
        const fieldKey = selectedCommentCategory === 'entryComments' ? 'entryComment' :
                         selectedCommentCategory === 'tradeManagement' ? 'tradeManagement' :
                         'exitComment';
        return (trade[fieldKey as keyof Trade] as string) || 'No Comment';
      } else {
        const tagIdToName = new Map<string, string>();
        tags.forEach(tag => tagIdToName.set(tag.id, tag.name));
        const targetTagIds = selectedTagIds.length > 0 ? selectedTagIds : tags.map(t => t.id);
        const tradeTagIds = trade.tags || [];
        const matchedTagIds = tradeTagIds.filter(tagId => targetTagIds.includes(tagId));
        
        if (matchedTagIds.length === 0 && selectedTagIds.length === 0) {
          return 'Untagged';
        }
        return matchedTagIds.map(tagId => tagIdToName.get(tagId) || 'Unknown Tag');
      }
    });

    // Build daily counts per group for trading activity metrics
    const groupDailyCounts = buildGroupDailyCounts(allTrades, (trade) => {
      if (selectionType === 'tradeComments') {
        const fieldKey = selectedCommentCategory === 'entryComments' ? 'entryComment' :
                         selectedCommentCategory === 'tradeManagement' ? 'tradeManagement' :
                         'exitComment';
        return (trade[fieldKey as keyof Trade] as string) || 'No Comment';
      } else {
        const tagIdToName = new Map<string, string>();
        tags.forEach(tag => tagIdToName.set(tag.id, tag.name));
        const targetTagIds = selectedTagIds.length > 0 ? selectedTagIds : tags.map(t => t.id);
        const tradeTagIds = trade.tags || [];
        const matchedTagIds = tradeTagIds.filter(tagId => targetTagIds.includes(tagId));
        
        if (matchedTagIds.length === 0 && selectedTagIds.length === 0) {
          return 'Untagged';
        }
        return matchedTagIds.map(tagId => tagIdToName.get(tagId) || 'Unknown Tag');
      }
    });

    const dataMap = new Map<string, {
      totalPnl: number;
      tradeCount: number;
      winCount: number;
      lossCount: number;
      beCount: number;
      totalDurationMinutes: number;
      longestDurationMinutes: number;
      longWinCount: number;
      longLossCount: number;
      shortWinCount: number;
      shortLossCount: number;
      longTradeCount: number;
      shortTradeCount: number;
      winPnlSum: number;
      lossPnlSum: number;
      largestWin: number;
      largestLoss: number;
    }>();

    if (selectionType === 'tradeComments') {
      const fieldKey = selectedCommentCategory === 'entryComments' ? 'entryComment' :
                       selectedCommentCategory === 'tradeManagement' ? 'tradeManagement' :
                       'exitComment';

      closedTrades.forEach(trade => {
        const metrics = calculateTradeMetrics(trade);
        const commentValue = trade[fieldKey as keyof Trade] as string || 'No Comment';
        
        const outcome = classifyTradeOutcome(metrics.netPnl, trade.savedReturnPercent, trade.breakEven);
        const durationMinutes = metrics.durationMinutes || 0;
        const isLong = trade.side === 'LONG';
        const isShort = trade.side === 'SHORT';
        const isWin = outcome === 'win';
        const isLoss = outcome === 'loss';
        const pnl = metrics.netPnl;
        
        const existing = dataMap.get(commentValue) || {
          totalPnl: 0,
          tradeCount: 0,
          winCount: 0,
          lossCount: 0,
          beCount: 0,
          totalDurationMinutes: 0,
          longestDurationMinutes: 0,
          longWinCount: 0,
          longLossCount: 0,
          shortWinCount: 0,
          shortLossCount: 0,
          longTradeCount: 0,
          shortTradeCount: 0,
          winPnlSum: 0,
          lossPnlSum: 0,
          largestWin: 0,
          largestLoss: 0,
        };

        dataMap.set(commentValue, {
          totalPnl: existing.totalPnl + pnl,
          tradeCount: existing.tradeCount + 1,
          winCount: existing.winCount + (isWin ? 1 : 0),
          lossCount: existing.lossCount + (isLoss ? 1 : 0),
          beCount: existing.beCount + (outcome === 'breakeven' ? 1 : 0),
          totalDurationMinutes: existing.totalDurationMinutes + durationMinutes,
          longestDurationMinutes: Math.max(existing.longestDurationMinutes, durationMinutes),
          longWinCount: existing.longWinCount + (isLong && isWin ? 1 : 0),
          longLossCount: existing.longLossCount + (isLong && isLoss ? 1 : 0),
          shortWinCount: existing.shortWinCount + (isShort && isWin ? 1 : 0),
          shortLossCount: existing.shortLossCount + (isShort && isLoss ? 1 : 0),
          longTradeCount: existing.longTradeCount + (isLong ? 1 : 0),
          shortTradeCount: existing.shortTradeCount + (isShort ? 1 : 0),
          winPnlSum: existing.winPnlSum + (isWin ? pnl : 0),
          lossPnlSum: existing.lossPnlSum + (isLoss ? pnl : 0),
          largestWin: isWin ? Math.max(existing.largestWin, pnl) : existing.largestWin,
          largestLoss: isLoss ? Math.min(existing.largestLoss, pnl) : existing.largestLoss,
        });
      });
    } else {
      const tagIdToName = new Map<string, string>();
      tags.forEach(tag => tagIdToName.set(tag.id, tag.name));

      const targetTagIds = selectedTagIds.length > 0 ? selectedTagIds : tags.map(t => t.id);

      closedTrades.forEach(trade => {
        const metrics = calculateTradeMetrics(trade);
        const outcome = classifyTradeOutcome(metrics.netPnl, trade.savedReturnPercent, trade.breakEven);
        const durationMinutes = metrics.durationMinutes || 0;
        const isLong = trade.side === 'LONG';
        const isShort = trade.side === 'SHORT';
        const isWin = outcome === 'win';
        const isLoss = outcome === 'loss';

        const tradeTagIds = trade.tags || [];
        const matchedTagIds = tradeTagIds.filter(tagId => targetTagIds.includes(tagId));
        const pnl = metrics.netPnl;
        
        if (matchedTagIds.length === 0 && selectedTagIds.length === 0) {
          const existing = dataMap.get('Untagged') || {
            totalPnl: 0,
            tradeCount: 0,
            winCount: 0,
            lossCount: 0,
            beCount: 0,
            totalDurationMinutes: 0,
            longestDurationMinutes: 0,
            longWinCount: 0,
            longLossCount: 0,
            shortWinCount: 0,
            shortLossCount: 0,
            longTradeCount: 0,
            shortTradeCount: 0,
            winPnlSum: 0,
            lossPnlSum: 0,
            largestWin: 0,
            largestLoss: 0,
          };
          dataMap.set('Untagged', {
            totalPnl: existing.totalPnl + pnl,
            tradeCount: existing.tradeCount + 1,
            winCount: existing.winCount + (isWin ? 1 : 0),
            lossCount: existing.lossCount + (isLoss ? 1 : 0),
            beCount: existing.beCount + (outcome === 'breakeven' ? 1 : 0),
            totalDurationMinutes: existing.totalDurationMinutes + durationMinutes,
            longestDurationMinutes: Math.max(existing.longestDurationMinutes, durationMinutes),
            longWinCount: existing.longWinCount + (isLong && isWin ? 1 : 0),
            longLossCount: existing.longLossCount + (isLong && isLoss ? 1 : 0),
            shortWinCount: existing.shortWinCount + (isShort && isWin ? 1 : 0),
            shortLossCount: existing.shortLossCount + (isShort && isLoss ? 1 : 0),
            longTradeCount: existing.longTradeCount + (isLong ? 1 : 0),
            shortTradeCount: existing.shortTradeCount + (isShort ? 1 : 0),
            winPnlSum: existing.winPnlSum + (isWin ? pnl : 0),
            lossPnlSum: existing.lossPnlSum + (isLoss ? pnl : 0),
            largestWin: isWin ? Math.max(existing.largestWin, pnl) : existing.largestWin,
            largestLoss: isLoss ? Math.min(existing.largestLoss, pnl) : existing.largestLoss,
          });
        } else {
          matchedTagIds.forEach(tagId => {
            const tagName = tagIdToName.get(tagId) || 'Unknown Tag';
            const existing = dataMap.get(tagName) || {
              totalPnl: 0,
              tradeCount: 0,
              winCount: 0,
              lossCount: 0,
              beCount: 0,
              totalDurationMinutes: 0,
              longestDurationMinutes: 0,
              longWinCount: 0,
              longLossCount: 0,
              shortWinCount: 0,
              shortLossCount: 0,
              longTradeCount: 0,
              shortTradeCount: 0,
              winPnlSum: 0,
              lossPnlSum: 0,
              largestWin: 0,
              largestLoss: 0,
            };
            dataMap.set(tagName, {
              totalPnl: existing.totalPnl + pnl,
              tradeCount: existing.tradeCount + 1,
              winCount: existing.winCount + (isWin ? 1 : 0),
              lossCount: existing.lossCount + (isLoss ? 1 : 0),
              beCount: existing.beCount + (outcome === 'breakeven' ? 1 : 0),
              totalDurationMinutes: existing.totalDurationMinutes + durationMinutes,
              longestDurationMinutes: Math.max(existing.longestDurationMinutes, durationMinutes),
              longWinCount: existing.longWinCount + (isLong && isWin ? 1 : 0),
              longLossCount: existing.longLossCount + (isLong && isLoss ? 1 : 0),
              shortWinCount: existing.shortWinCount + (isShort && isWin ? 1 : 0),
              shortLossCount: existing.shortLossCount + (isShort && isLoss ? 1 : 0),
              longTradeCount: existing.longTradeCount + (isLong ? 1 : 0),
              shortTradeCount: existing.shortTradeCount + (isShort ? 1 : 0),
              winPnlSum: existing.winPnlSum + (isWin ? pnl : 0),
              lossPnlSum: existing.lossPnlSum + (isLoss ? pnl : 0),
              largestWin: isWin ? Math.max(existing.largestWin, pnl) : existing.largestWin,
              largestLoss: isLoss ? Math.min(existing.largestLoss, pnl) : existing.largestLoss,
            });
          });
        }
      });
    }

    const data: GroupedData[] = Array.from(dataMap.entries())
      .map(([name, data]) => {
        const winsAndLosses = data.winCount + data.lossCount;
        const winrate = winsAndLosses > 0 ? (data.winCount / winsAndLosses) * 100 : 0;
        const returnPercent = totalStartingBalance > 0
          ? (data.totalPnl / totalStartingBalance) * 100
          : 0;

        const avgHoldTimeMinutes = data.tradeCount > 0 ? data.totalDurationMinutes / data.tradeCount : 0;
        const longestDurationMinutes = data.longestDurationMinutes;
        
        // Long Win % = Long Wins / (Long Wins + Long Losses)
        const longWinsAndLosses = data.longWinCount + data.longLossCount;
        const longWinrate = longWinsAndLosses > 0 ? (data.longWinCount / longWinsAndLosses) * 100 : 0;
        
        // Short Win % = Short Wins / (Short Wins + Short Losses)
        const shortWinsAndLosses = data.shortWinCount + data.shortLossCount;
        const shortWinrate = shortWinsAndLosses > 0 ? (data.shortWinCount / shortWinsAndLosses) * 100 : 0;
        
        // Profitability metrics
        const avgWin = data.winCount > 0 ? data.winPnlSum / data.winCount : 0;
        const avgLoss = data.lossCount > 0 ? data.lossPnlSum / data.lossCount : 0;
        const largestWin = data.largestWin;
        const largestLoss = data.largestLoss;

        let displayValue: number;
        switch (displayType) {
          case 'dollar':
            displayValue = data.totalPnl;
            break;
          case 'percent':
            displayValue = returnPercent;
            break;
          case 'winrate':
            displayValue = winrate;
            break;
          case 'tradecount':
            displayValue = data.tradeCount;
            break;
          case 'avg_hold_time':
            displayValue = avgHoldTimeMinutes;
            break;
          case 'longest_duration':
            displayValue = longestDurationMinutes;
            break;
          case 'long_winrate':
            displayValue = longWinrate;
            break;
          case 'short_winrate':
            displayValue = shortWinrate;
            break;
          case 'tradecount_long':
            displayValue = data.longTradeCount;
            break;
          case 'tradecount_short':
            displayValue = data.shortTradeCount;
            break;
          case 'avg_win':
            displayValue = avgWin;
            break;
          case 'avg_loss':
            displayValue = avgLoss;
            break;
          case 'largest_win':
            displayValue = largestWin;
            break;
          case 'largest_loss':
            displayValue = largestLoss;
            break;
          case 'avg_trades_per_day':
            displayValue = getGroupTradingActivityStats(groupDailyCounts, name).avgTradesPerDay;
            break;
          case 'median_trades_per_day':
            displayValue = getGroupTradingActivityStats(groupDailyCounts, name).medianTradesPerDay;
            break;
          case '90th_percentile_trades':
            displayValue = getGroupTradingActivityStats(groupDailyCounts, name).percentile90TradesPerDay;
            break;
          case 'logged_days':
            displayValue = getGroupTradingActivityStats(groupDailyCounts, name).loggedDays;
            break;
          case 'profit_factor':
            // Guard: 0 when grossLoss is 0 to prevent Infinity
            displayValue = Math.abs(data.lossPnlSum) > 0 ? data.winPnlSum / Math.abs(data.lossPnlSum) : 0;
            break;
          case 'trade_expectancy':
            const winPct = data.tradeCount > 0 ? data.winCount / data.tradeCount : 0;
            const lossPct = data.tradeCount > 0 ? data.lossCount / data.tradeCount : 0;
            displayValue = (winPct * avgWin) - (lossPct * Math.abs(avgLoss));
            break;
          case 'avg_net_trade_pnl':
            displayValue = data.tradeCount > 0 ? data.totalPnl / data.tradeCount : 0;
            break;
          case 'avg_realized_r':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, name, breakevenTolerance).avgRealizedR;
            break;
          case 'avg_planned_r':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, name, breakevenTolerance).avgPlannedR;
            break;
          case 'avg_daily_drawdown':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, name, breakevenTolerance).avgDailyDrawdown;
            break;
          case 'largest_daily_loss':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, name, breakevenTolerance).largestDailyLoss;
            break;
          case 'winning_days_count':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, name, breakevenTolerance).winningDaysCount;
            break;
          case 'losing_days_count':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, name, breakevenTolerance).losingDaysCount;
            break;
          case 'breakeven_days_count':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, name, breakevenTolerance).breakevenDaysCount;
            break;
          default:
            displayValue = data.totalPnl;
        }

        // Get trading activity stats for this group
        const tradingActivityStats = getGroupTradingActivityStats(groupDailyCounts, name);
        
        // Calculate profitability metrics
        const grossProfit = data.winPnlSum;
        const grossLoss = Math.abs(data.lossPnlSum);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        const avgNetTradePnl = data.tradeCount > 0 ? data.totalPnl / data.tradeCount : 0;
        const winPctForExp = data.tradeCount > 0 ? data.winCount / data.tradeCount : 0;
        const lossPctForExp = data.tradeCount > 0 ? data.lossCount / data.tradeCount : 0;
        const tradeExpectancy = (winPctForExp * avgWin) - (lossPctForExp * Math.abs(avgLoss));
        
        // Get Risk & Drawdown stats for this group
        const riskDrawdownStats = getGroupRiskDrawdownStats(groupedTradesMap, name, breakevenTolerance);

        return {
          name,
          totalPnl: data.totalPnl,
          totalPercent: returnPercent,
          tradeCount: data.tradeCount,
          winCount: data.winCount,
          lossCount: data.lossCount,
          beCount: data.beCount,
          avgPnl: data.totalPnl / data.tradeCount,
          winrate,
          displayValue,
          avgHoldTimeMinutes,
          longestDurationMinutes,
          longWinCount: data.longWinCount,
          longLossCount: data.longLossCount,
          longWinrate,
          shortWinCount: data.shortWinCount,
          shortLossCount: data.shortLossCount,
          shortWinrate,
          longTradeCount: data.longTradeCount,
          shortTradeCount: data.shortTradeCount,
          avgWin,
          avgLoss,
          largestWin,
          largestLoss,
          winPnlSum: data.winPnlSum,
          lossPnlSum: data.lossPnlSum,
          avgTradesPerDay: tradingActivityStats.avgTradesPerDay,
          medianTradesPerDay: tradingActivityStats.medianTradesPerDay,
          percentile90TradesPerDay: tradingActivityStats.percentile90TradesPerDay,
          maxTradesInDay: tradingActivityStats.maxTradesInDay,
          loggedDays: tradingActivityStats.loggedDays,
          profitFactor,
          tradeExpectancy,
          avgNetTradePnl,
          grossProfit,
          grossLoss,
          // Risk & Drawdown metrics
          avgRealizedR: riskDrawdownStats.avgRealizedR,
          avgPlannedR: riskDrawdownStats.avgPlannedR,
          avgDailyDrawdown: riskDrawdownStats.avgDailyDrawdown,
          largestDailyLoss: riskDrawdownStats.largestDailyLoss,
          largestDailyLossDate: riskDrawdownStats.largestDailyLossDate,
          losingDaysCount: riskDrawdownStats.losingDaysCount,
          winningDaysCount: riskDrawdownStats.winningDaysCount,
          breakevenDaysCount: riskDrawdownStats.breakevenDaysCount,
          tradesWithRealizedR: riskDrawdownStats.tradesWithRealizedR,
          tradesWithPlannedR: riskDrawdownStats.tradesWithPlannedR,
        };
      })
      .sort((a, b) => b.displayValue - a.displayValue);

    return data;
  }, [filteredTrades, selectionType, selectedCommentCategory, selectedTagIds, displayType, totalStartingBalance, tags, classifyTradeOutcome]);

  const isMultiMetric = selectedMetrics.length > 1;
  const multiMetricChartData = useMemo(() => {
    if (!isMultiMetric) return groupedData;
    return groupedData.map(item => {
      const enhanced: Record<string, unknown> = { ...item };
      selectedMetrics.forEach((metric, index) => {
        enhanced[`metric_${index}`] = getMetricValue(item, metric);
      });
      return enhanced;
    });
  }, [groupedData, selectedMetrics, isMultiMetric]);

  const formatMetricTick = (value: number, metricType: ChartDisplayType): string => {
    if (isPrivacyMode && ['dollar', 'percent', 'avg_win', 'avg_loss', 'largest_win', 'largest_loss', 'trade_expectancy', 'avg_net_trade_pnl', 'profit_factor', 'avg_daily_drawdown', 'largest_daily_loss'].includes(metricType)) return '**';
    switch (metricType) {
      case 'dollar': case 'avg_win': case 'avg_loss': case 'largest_win': case 'largest_loss': case 'trade_expectancy': case 'avg_net_trade_pnl': case 'avg_daily_drawdown': case 'largest_daily_loss': return `${currencyConfig.symbol}${value.toFixed(0)}`;
      case 'percent': case 'winrate': case 'long_winrate': case 'short_winrate': return `${value.toFixed(0)}%`;
      case 'tradecount': case 'tradecount_long': case 'tradecount_short': case 'avg_trades_per_day': case 'median_trades_per_day': case '90th_percentile_trades': case 'logged_days': case 'winning_days_count': case 'losing_days_count': case 'breakeven_days_count': return value % 1 === 0 ? `${Math.round(value)}` : value.toFixed(1);
      case 'avg_hold_time': case 'longest_duration': return formatDurationTick(value);
      case 'profit_factor': return value === Infinity ? '∞' : value.toFixed(2);
      case 'avg_realized_r': case 'avg_planned_r': return value.toFixed(2);
      default: return `${value}`;
    }
  };
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload as GroupedData;

    if (displayType === 'tradecount') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Total Trades: {data.tradeCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'avg_hold_time') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Avg Hold Time: <span className="text-foreground">{formatDuration(data.avgHoldTimeMinutes)}</span></p>
            <p>Total Trades: {data.tradeCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'longest_duration') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Longest Duration: <span className="text-foreground">{formatDuration(data.longestDurationMinutes)}</span></p>
            <p>Total Trades: {data.tradeCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'winrate') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Winrate: <span className="text-foreground">{data.winrate.toFixed(1)}%</span></p>
            <p>Total Trades: {data.tradeCount}</p>
            <p>Winners: {data.winCount}</p>
            <p>Losers: {data.lossCount}</p>
            <p>BE: {data.beCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'long_winrate') {
      const longTotal = data.longWinCount + data.longLossCount;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Long Win %: <span className="text-foreground">{data.longWinrate.toFixed(1)}%</span></p>
            <p>Long Wins: {data.longWinCount}</p>
            <p>Long Losses: {data.longLossCount}</p>
            <p>Total Long Trades: {longTotal}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'short_winrate') {
      const shortTotal = data.shortWinCount + data.shortLossCount;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Short Win %: <span className="text-foreground">{data.shortWinrate.toFixed(1)}%</span></p>
            <p>Short Wins: {data.shortWinCount}</p>
            <p>Short Losses: {data.shortLossCount}</p>
            <p>Total Short Trades: {shortTotal}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'tradecount_long') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Trade Count (Long): <span className="text-foreground">{data.longTradeCount}</span></p>
            <p>Direction: Long</p>
          </div>
        </div>
      );
    }

    if (displayType === 'tradecount_short') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Trade Count (Short): <span className="text-foreground">{data.shortTradeCount}</span></p>
            <p>Direction: Short</p>
          </div>
        </div>
      );
    }

    if (displayType === 'avg_win') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Avg Win: <span className={data.avgWin >= 0 ? 'text-profit' : 'text-foreground'}>
              {isPrivacyMode ? '**' : `${currencyConfig.symbol}${data.avgWin.toFixed(2)}`}
            </span></p>
            <p>Winning Trades: {data.winCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'avg_loss') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Avg Loss: <span className={data.avgLoss < 0 ? 'text-loss' : 'text-foreground'}>
              {isPrivacyMode ? '**' : `${data.avgLoss < 0 ? '-' : ''}${currencyConfig.symbol}${Math.abs(data.avgLoss).toFixed(2)}`}
            </span></p>
            <p>Losing Trades: {data.lossCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'largest_win') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Largest Win: <span className={data.largestWin >= 0 ? 'text-profit' : 'text-foreground'}>
              {isPrivacyMode ? '**' : `${currencyConfig.symbol}${data.largestWin.toFixed(2)}`}
            </span></p>
            <p>Winning Trades: {data.winCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'largest_loss') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Largest Loss: <span className={data.largestLoss < 0 ? 'text-loss' : 'text-foreground'}>
              {isPrivacyMode ? '**' : `${data.largestLoss < 0 ? '-' : ''}${currencyConfig.symbol}${Math.abs(data.largestLoss).toFixed(2)}`}
            </span></p>
            <p>Losing Trades: {data.lossCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'avg_trades_per_day') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Avg Trades/Day: <span className="text-foreground">{data.avgTradesPerDay.toFixed(1)}</span></p>
            <p>Logged Days: {data.loggedDays}</p>
            <p>Total Trades: {data.tradeCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'median_trades_per_day') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Median Trades/Day: <span className="text-foreground">{data.medianTradesPerDay.toFixed(1)}</span></p>
            <p>Logged Days: {data.loggedDays}</p>
            <p>Total Trades: {data.tradeCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === '90th_percentile_trades') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>90th Percentile Trades / Day: <span className="text-foreground">{Math.round(data.percentile90TradesPerDay)}</span></p>
            <p>Median Trades / Day: {data.medianTradesPerDay.toFixed(1)}</p>
            <p>Max Trades in a Day: {data.maxTradesInDay}</p>
            <p className="text-xs mt-2 italic border-t border-border pt-2">
              Largest drawdowns occur when trades/day &gt; {Math.round(data.percentile90TradesPerDay)}
            </p>
          </div>
        </div>
      );
    }

    if (displayType === 'logged_days') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Logged Days: <span className="text-foreground">{data.loggedDays}</span></p>
            <p>Total Trades: {data.tradeCount}</p>
            <p>Median Trades / Day: {data.medianTradesPerDay.toFixed(1)}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'profit_factor') {
      const pfDisplay = data.profitFactor === Infinity ? '∞' : data.profitFactor.toFixed(2);
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Profit Factor: <span className="text-foreground">{isPrivacyMode ? '**' : pfDisplay}</span></p>
            <p>Gross Profit: <span className={data.grossProfit >= 0 ? 'text-profit' : 'text-foreground'}>{isPrivacyMode ? '**' : `+${currencyConfig.symbol}${data.grossProfit.toFixed(2)}`}</span></p>
            <p>Gross Loss: <span className="text-loss">{isPrivacyMode ? '**' : `-${currencyConfig.symbol}${data.grossLoss.toFixed(2)}`}</span></p>
            <p>Total Trades: {data.tradeCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'avg_net_trade_pnl') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Avg Net P&L / Trade: <span className={data.avgNetTradePnl >= 0 ? 'text-profit' : 'text-loss'}>{isPrivacyMode ? '**' : `${data.avgNetTradePnl >= 0 ? '+' : ''}${currencyConfig.symbol}${data.avgNetTradePnl.toFixed(2)}`}</span></p>
            <p>Net P&L: <span className={data.totalPnl >= 0 ? 'text-profit' : 'text-loss'}>{isPrivacyMode ? '**' : `${data.totalPnl >= 0 ? '+' : ''}${currencyConfig.symbol}${data.totalPnl.toFixed(2)}`}</span></p>
            <p>Total Trades: {data.tradeCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'trade_expectancy') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Trade Expectancy: <span className={data.tradeExpectancy >= 0 ? 'text-profit' : 'text-loss'}>{isPrivacyMode ? '**' : `${data.tradeExpectancy >= 0 ? '+' : ''}${currencyConfig.symbol}${data.tradeExpectancy.toFixed(2)}`}</span></p>
            <p>Win Rate: {data.winrate.toFixed(1)}%</p>
            <p>Avg Win: <span className={data.avgWin >= 0 ? 'text-profit' : 'text-foreground'}>{isPrivacyMode ? '**' : `${currencyConfig.symbol}${data.avgWin.toFixed(2)}`}</span></p>
            <p>Avg Loss: <span className="text-loss">{isPrivacyMode ? '**' : `-${currencyConfig.symbol}${Math.abs(data.avgLoss).toFixed(2)}`}</span></p>
          </div>
        </div>
      );
    }

    if (displayType === 'dollar') {
      const pnlValue = isPrivacyMode ? '**' : `${data.totalPnl >= 0 ? '+' : ''}${currencyConfig.symbol}${Math.abs(data.totalPnl).toFixed(2)}`;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Net PNL: <span className={isPrivacyMode ? 'text-foreground' : data.totalPnl >= 0 ? 'text-profit' : 'text-loss'}>{pnlValue}</span></p>
            <p>Total Trades: {data.tradeCount}</p>
            <p>Winners: {data.winCount}</p>
            <p>Losers: {data.lossCount}</p>
            <p>BE: {data.beCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'percent') {
      const returnValue = isPrivacyMode ? '**' : `${data.totalPercent >= 0 ? '+' : ''}${data.totalPercent.toFixed(2)}%`;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Return %: <span className={isPrivacyMode ? 'text-foreground' : data.totalPercent >= 0 ? 'text-profit' : 'text-loss'}>{returnValue}</span></p>
            <p>Total Trades: {data.tradeCount}</p>
            <p>Winners: {data.winCount}</p>
            <p>Losers: {data.lossCount}</p>
            <p>BE: {data.beCount}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'winning_days_count') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Winning Days: <span className="text-profit">{data.winningDaysCount}</span></p>
            <p>Total Logged Days: {data.loggedDays}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'losing_days_count') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Losing Days: <span className="text-loss">{data.losingDaysCount}</span></p>
            <p>Total Logged Days: {data.loggedDays}</p>
          </div>
        </div>
      );
    }

    if (displayType === 'breakeven_days_count') {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Breakeven Days: <span className="text-foreground">{data.breakevenDaysCount}</span></p>
            <p>Breakeven Threshold: {currencyConfig.symbol}250</p>
            <p>Total Logged Days: {data.loggedDays}</p>
          </div>
        </div>
      );
    }

    // Tick/Pip and Privacy modes
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
        <p className="font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1 text-muted-foreground">
          <p>{displayType === 'privacy' ? '•••••' : '--'}</p>
          <p>Total Trades: {data.tradeCount}</p>
          <p>Winners: {data.winCount}</p>
          <p>Losers: {data.lossCount}</p>
          <p>BE: {data.beCount}</p>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card border-border h-full">
      <CardContent className="p-4 pb-2">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {selectionType === 'tags' ? 'Tags Performance' : 'Comments Performance'}
            </h3>
            <ChartMetricSettingsPopover metrics={selectedMetrics} configs={metricConfigs} onConfigChange={updateMetricConfig} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedMetrics.map((metric, index) => (
              <div key={`${metric}-${index}`} className="flex items-center gap-1.5">
                {isMultiMetric && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getMetricColor(index) }} />}
                <ChartDisplayDropdown value={metric} onValueChange={(v) => { const next = [...selectedMetrics]; next[index] = v; setSelectedMetrics(next); }} disabledValues={selectedMetrics.filter((_, i) => i !== index)} />
                {selectedMetrics.length > 1 && (
                  <button onClick={() => removeMetric(index)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
            {selectedMetrics.length < 3 && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addMetric}><Plus className="w-3.5 h-3.5" />Add Metric</Button>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className={`w-full -mx-2 px-0 ${isMultiMetric ? 'h-[340px]' : 'h-[300px]'}`}>
          {groupedData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={isMultiMetric ? multiMetricChartData : groupedData} margin={{ top: 10, right: isMultiMetric ? (selectedMetrics.length === 3 ? 25 : 20) : -5, left: -10, bottom: isMultiMetric ? 30 : 60 }}>
                <Customized component={() => <ChartGradientDefs direction="vertical" idPrefix="tagsComments" />} />
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.3} />
                <XAxis 
                  type="category" 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                
                {isMultiMetric ? (
                  <>
                    {selectedMetrics.map((metric, index) => (
                      <YAxis key={metric} yAxisId={`y-${index}`} orientation={index === 0 ? 'left' : 'right'} axisLine={{ stroke: getMetricColor(index) }} tickLine={false} tick={{ fill: getMetricColor(index), fontSize: 10 }} tickFormatter={(value) => formatMetricTick(value, metric)} width={index === 0 ? 40 : 32} />
                    ))}
                  </>
                ) : (
                  <YAxis 
                    type="number" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(value) => formatMetricTick(value, displayType)}
                    width={50}
                  />
                )}
                
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.1)' }} />
                {!isMultiMetric && <ReferenceLine y={0} stroke="hsl(var(--border))" />}
                
                <Legend
                  verticalAlign="bottom"
                  height={24}
                  content={() => (
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-1">
                      {isMultiMetric ? (
                        selectedMetrics.map((metric, index) => {
                          const config = metricConfigs[index];
                          return (
                            <div key={metric} className="flex items-center gap-1.5">
                              {config?.type === 'line' ? (
                                <div className="w-4 h-0.5 rounded" style={{ backgroundColor: getMetricColor(index) }} />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getMetricColor(index) }} />
                              )}
                              <span className="text-xs text-muted-foreground">{getDisplayLabel(metric)}</span>
                            </div>
                          );
                        })
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-profit" />
                            <span className="text-xs text-muted-foreground">Profit</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-loss" />
                            <span className="text-xs text-muted-foreground">Loss</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                />

                {isMultiMetric ? (
                  <>
                    {selectedMetrics.map((metric, index) => {
                      const config = metricConfigs[index];
                      const color = getMetricColor(index);
                      if (config?.type === 'line') {
                        return (
                          <Line key={`line-${metric}-${index}`} yAxisId={`y-${index}`} type="monotone" dataKey={`metric_${index}`} stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} activeDot={{ r: 5 }} />
                        );
                      }
                      return (
                        <Bar key={`bar-${metric}-${index}`} yAxisId={`y-${index}`} dataKey={`metric_${index}`} fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
                      );
                    })}
                  </>
                ) : metricConfigs[0]?.type === 'line' ? (
                  <Line
                    type="monotone"
                    dataKey="displayValue"
                    stroke={metricConfigs[0]?.color || 'hsl(var(--chart-1))'}
                    strokeWidth={2}
                    dot={{ fill: metricConfigs[0]?.color || 'hsl(var(--chart-1))', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ) : (
                  <Bar dataKey="displayValue" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {groupedData.map((entry, index) => {
                      const config = metricConfigs[0];
                      const isPnlMetric = displayType === 'dollar' || displayType === 'percent' || displayType === 'avg_win' || displayType === 'avg_loss' || displayType === 'largest_win' || displayType === 'largest_loss' || displayType === 'trade_expectancy' || displayType === 'avg_net_trade_pnl' || displayType === 'avg_daily_drawdown' || displayType === 'largest_daily_loss' || displayType === 'avg_realized_r' || displayType === 'avg_planned_r';
                      let fillColor: string;
                      if (isPnlMetric) {
                        fillColor = getFill(entry.displayValue >= 0);
                      } else if (config?.color && config.color !== DEFAULT_METRIC_COLORS[0]) {
                        fillColor = config.color;
                      } else if (displayType === 'winrate' || displayType === 'tradecount' || displayType === 'avg_hold_time' || displayType === 'longest_duration' || displayType === 'long_winrate' || displayType === 'short_winrate' || displayType === 'tradecount_long' || displayType === 'tradecount_short' || displayType === 'logged_days' || displayType === 'profit_factor' || displayType === 'avg_trades_per_day' || displayType === 'median_trades_per_day' || displayType === '90th_percentile_trades') {
                        fillColor = primaryFill;
                      } else {
                        fillColor = getFill(entry.displayValue >= 0);
                      }
                      return <Cell key={`cell-${index}`} fill={fillColor} />;
                    })}
                  </Bar>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full border border-dashed border-border rounded-xl bg-muted/20">
              <p className="text-muted-foreground text-sm">
                {selectionType === 'tags' 
                  ? 'No trades with tags found.'
                  : 'No trades with comments found.'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
