import { useMemo, useState } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { parseISO, format } from 'date-fns';
import { ChartDisplayType, mapGlobalToChartDisplay, formatDuration, formatDurationTick } from '@/hooks/useChartDisplayMode';
import { calculateTradingActivityStatsFromCounts } from '@/lib/tradingActivityStats';
import { calculateRiskDrawdownStats } from '@/lib/riskDrawdownStats';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ChartDisplayDropdown } from './ChartDisplayDropdown';
import { ChartMetricSettingsPopover, MetricConfig } from './ChartMetricSettingsPopover';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { getDisplayLabel } from '@/hooks/useChartDisplayMode';

// Bucket size options - bucket widths in MINUTES, plus 'preset' for the legacy mixed buckets.
type BucketSizeType = '5min' | '15min' | '30min' | '1hour' | '2hour' | '4hour' | '1day' | 'preset';

interface DurationData {
  label: string;
  sortOrder: number;
  totalPnl: number;
  totalPercent: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
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
  avgTradesPerDay: number;
  medianTradesPerDay: number;
  percentile90TradesPerDay: number;
  maxTradesInDay: number;
  loggedDays: number;
  profitFactor: number;
  tradeExpectancy: number;
  avgNetTradePnl: number;
  grossProfit: number;
  grossLoss: number;
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

interface PerformanceByDurationCompareChartProps {
  defaultDisplayType?: ChartDisplayType;
  title?: string;
  useGlobalDefault?: boolean;
}

const DEFAULT_METRIC_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--profit))',
  'hsl(45 93% 47%)',
];

const getMetricValue = (data: DurationData, metric: ChartDisplayType): number => {
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
    case 'avg_trades_per_day': return data.avgTradesPerDay;
    case 'median_trades_per_day': return data.medianTradesPerDay;
    case '90th_percentile_trades': return data.percentile90TradesPerDay;
    case 'logged_days': return data.loggedDays;
    case 'profit_factor': return data.profitFactor;
    case 'trade_expectancy': return data.tradeExpectancy;
    case 'avg_net_trade_pnl': return data.avgNetTradePnl;
    case 'avg_realized_r': return data.avgRealizedR;
    case 'avg_planned_r': return data.avgPlannedR;
    case 'avg_daily_drawdown': return data.avgDailyDrawdown;
    case 'largest_daily_loss': return data.largestDailyLoss;
    case 'winning_days_count': return data.winningDaysCount;
    case 'losing_days_count': return data.losingDaysCount;
    case 'breakeven_days_count': return data.breakevenDaysCount;
    default: return data.totalPnl;
  }
};

// Preset mixed buckets matching legacy DURATION_BUCKETS
const PRESET_BUCKETS: Array<{ minMin: number; maxMin: number; label: string }> = [
  { minMin: 0, maxMin: 0.25, label: '0s–15s' },
  { minMin: 0.25, maxMin: 1, label: '15s–1m' },
  { minMin: 1, maxMin: 5, label: '1m–5m' },
  { minMin: 5, maxMin: 15, label: '5m–15m' },
  { minMin: 15, maxMin: 30, label: '15m–30m' },
  { minMin: 30, maxMin: 60, label: '30m–1h' },
  { minMin: 60, maxMin: 120, label: '1h–2h' },
  { minMin: 120, maxMin: 240, label: '2h–4h' },
  { minMin: 240, maxMin: 1440, label: '4h–24h' },
  { minMin: 1440, maxMin: Infinity, label: '1d+' },
];

const formatBucketRange = (startMin: number, widthMin: number): string => {
  const endMin = startMin + widthMin;
  // Day-scale buckets
  if (widthMin >= 1440) {
    const startDays = startMin / 1440;
    const endDays = endMin / 1440;
    return `${startDays}d–${endDays}d`;
  }
  // Hour-scale buckets
  if (widthMin >= 60) {
    const startHrs = startMin / 60;
    const endHrs = endMin / 60;
    return `${startHrs}h–${endHrs}h`;
  }
  // Minute-scale buckets
  return `${startMin}m–${endMin}m`;
};

// Returns bucket label + sortOrder (the lower bound in minutes) for a given trade duration.
const getDurationBucket = (
  durationMinutes: number,
  bucketSize: BucketSizeType
): { label: string; sortOrder: number } => {
  if (bucketSize === 'preset') {
    const found = PRESET_BUCKETS.find(b => durationMinutes >= b.minMin && durationMinutes < b.maxMin);
    if (found) {
      return { label: found.label, sortOrder: found.minMin };
    }
    const last = PRESET_BUCKETS[PRESET_BUCKETS.length - 1];
    return { label: last.label, sortOrder: last.minMin };
  }

  const widthMap: Record<Exclude<BucketSizeType, 'preset'>, number> = {
    '5min': 5,
    '15min': 15,
    '30min': 30,
    '1hour': 60,
    '2hour': 120,
    '4hour': 240,
    '1day': 1440,
  };
  const width = widthMap[bucketSize];
  const startMin = Math.floor(Math.max(0, durationMinutes) / width) * width;
  return {
    label: formatBucketRange(startMin, width),
    sortOrder: startMin,
  };
};

export const PerformanceByDurationCompareChart = ({
  defaultDisplayType = 'dollar',
  title = 'Performance by Holding Time',
  useGlobalDefault = true,
}: PerformanceByDurationCompareChartProps) => {
  const { filteredTrades } = useFilteredTrades();
  const { currencyConfig, selectedAccounts, isAllAccountsSelected, classifyTradeOutcome, displayMode, breakevenTolerance } = useGlobalFilters();
  const { accounts, getAccountBalanceBeforeTrades } = useAccountsContext();
  const { isPrivacyMode } = usePrivacyMode();
  const { getFill, primaryFill } = useGradientFill('durationPerf');

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
    setMetricConfigs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  };

  const addMetric = () => {
    if (selectedMetrics.length >= 3) return;
    const allOptions: ChartDisplayType[] = ['dollar', 'winrate', 'tradecount', 'percent', 'avg_win', 'avg_loss', 'profit_factor', 'trade_expectancy'];
    const next = allOptions.find(m => !selectedMetrics.includes(m)) || 'dollar';
    setSelectedMetrics(prev => [...prev, next]);
    setMetricConfigs(prev => [...prev, { type: 'column', color: DEFAULT_METRIC_COLORS[prev.length] || DEFAULT_METRIC_COLORS[0] }]);
  };

  const removeMetric = (index: number) => {
    setSelectedMetrics(prev => prev.filter((_, i) => i !== index));
    setMetricConfigs(prev => prev.filter((_, i) => i !== index));
  };

  const [bucketSize, setBucketSize] = useState<BucketSizeType>('preset');

  // Total starting balance for Return (%) denominator
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

  const durationData = useMemo(() => {
    const closedTrades = filteredTrades.filter((trade: Trade) => {
      const metrics = calculateTradeMetrics(trade);
      return metrics.positionStatus === 'CLOSED' && metrics.durationMinutes >= 0;
    });

    if (closedTrades.length === 0) return [];

    // bucketLabel -> calendarDay -> count (for trading activity stats)
    const bucketDailyCounts = new Map<string, Map<string, number>>();
    // bucketLabel -> trades (for risk/drawdown stats)
    const bucketTrades = new Map<string, Trade[]>();

    const bucketMap = new Map<string, {
      sortOrder: number;
      totalPnl: number;
      tradeCount: number;
      winCount: number;
      lossCount: number;
      breakevenCount: number;
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

    // Build daily counts and bucket trades
    closedTrades.forEach(trade => {
      const metrics = calculateTradeMetrics(trade);
      const durationMinutes = metrics.durationMinutes || 0;
      const bucket = getDurationBucket(durationMinutes, bucketSize);

      if (!bucketTrades.has(bucket.label)) bucketTrades.set(bucket.label, []);
      bucketTrades.get(bucket.label)!.push(trade);

      const dateStr = metrics.openDate;
      if (dateStr) {
        const dayKey = format(parseISO(dateStr), 'yyyy-MM-dd');
        if (!bucketDailyCounts.has(bucket.label)) bucketDailyCounts.set(bucket.label, new Map());
        const dailyMap = bucketDailyCounts.get(bucket.label)!;
        dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
      }
    });

    closedTrades.forEach(trade => {
      const metrics = calculateTradeMetrics(trade);
      const durationMinutes = metrics.durationMinutes || 0;
      const bucket = getDurationBucket(durationMinutes, bucketSize);

      const outcome = classifyTradeOutcome(metrics.netPnl, trade.savedReturnPercent, trade.breakEven);
      const isLong = trade.side === 'LONG';
      const isShort = trade.side === 'SHORT';
      const isWin = outcome === 'win';
      const isLoss = outcome === 'loss';
      const pnl = metrics.netPnl;

      const existing = bucketMap.get(bucket.label) || {
        sortOrder: bucket.sortOrder,
        totalPnl: 0,
        tradeCount: 0,
        winCount: 0,
        lossCount: 0,
        breakevenCount: 0,
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

      bucketMap.set(bucket.label, {
        sortOrder: bucket.sortOrder,
        totalPnl: existing.totalPnl + pnl,
        tradeCount: existing.tradeCount + 1,
        winCount: existing.winCount + (isWin ? 1 : 0),
        lossCount: existing.lossCount + (isLoss ? 1 : 0),
        breakevenCount: existing.breakevenCount + (outcome === 'breakeven' ? 1 : 0),
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

    const data: DurationData[] = Array.from(bucketMap.entries())
      .map(([label, d]) => {
        const winsAndLosses = d.winCount + d.lossCount;
        const winrate = winsAndLosses > 0 ? (d.winCount / winsAndLosses) * 100 : 0;
        const returnPercent = totalStartingBalance > 0 ? (d.totalPnl / totalStartingBalance) * 100 : 0;
        const avgHoldTimeMinutes = d.tradeCount > 0 ? d.totalDurationMinutes / d.tradeCount : 0;
        const longestDurationMinutes = d.longestDurationMinutes;

        const longWinsAndLosses = d.longWinCount + d.longLossCount;
        const longWinrate = longWinsAndLosses > 0 ? (d.longWinCount / longWinsAndLosses) * 100 : 0;
        const shortWinsAndLosses = d.shortWinCount + d.shortLossCount;
        const shortWinrate = shortWinsAndLosses > 0 ? (d.shortWinCount / shortWinsAndLosses) * 100 : 0;

        const avgWin = d.winCount > 0 ? d.winPnlSum / d.winCount : 0;
        const avgLoss = d.lossCount > 0 ? d.lossPnlSum / d.lossCount : 0;
        const largestWin = d.largestWin;
        const largestLoss = d.largestLoss;

        let displayValue = 0;
        switch (displayType) {
          case 'percent': displayValue = returnPercent; break;
          case 'winrate': displayValue = winrate; break;
          case 'tradecount': displayValue = d.tradeCount; break;
          case 'avg_hold_time': displayValue = avgHoldTimeMinutes; break;
          case 'longest_duration': displayValue = longestDurationMinutes; break;
          case 'long_winrate': displayValue = longWinrate; break;
          case 'short_winrate': displayValue = shortWinrate; break;
          case 'tradecount_long': displayValue = d.longTradeCount; break;
          case 'tradecount_short': displayValue = d.shortTradeCount; break;
          case 'avg_win': displayValue = avgWin; break;
          case 'avg_loss': displayValue = avgLoss; break;
          case 'largest_win': displayValue = largestWin; break;
          case 'largest_loss': displayValue = largestLoss; break;
          case 'dollar':
          default: displayValue = d.totalPnl; break;
        }

        const dailyMap = bucketDailyCounts.get(label);
        const dailyCounts = dailyMap ? Array.from(dailyMap.values()) : [];
        const tradingActivityStats = calculateTradingActivityStatsFromCounts(dailyCounts);

        const grossProfit = d.winPnlSum;
        const grossLoss = Math.abs(d.lossPnlSum);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        const avgNetTradePnl = d.tradeCount > 0 ? d.totalPnl / d.tradeCount : 0;
        const winPctForExp = d.tradeCount > 0 ? d.winCount / d.tradeCount : 0;
        const lossPctForExp = d.tradeCount > 0 ? d.lossCount / d.tradeCount : 0;
        const tradeExpectancy = (winPctForExp * avgWin) - (lossPctForExp * Math.abs(avgLoss));

        const bucketTradesList = bucketTrades.get(label) || [];
        const riskDrawdownStats = calculateRiskDrawdownStats(bucketTradesList, breakevenTolerance);

        if (displayType === 'avg_trades_per_day') displayValue = tradingActivityStats.avgTradesPerDay;
        else if (displayType === 'median_trades_per_day') displayValue = tradingActivityStats.medianTradesPerDay;
        else if (displayType === '90th_percentile_trades') displayValue = tradingActivityStats.percentile90TradesPerDay;
        else if (displayType === 'logged_days') displayValue = tradingActivityStats.loggedDays;
        else if (displayType === 'profit_factor') displayValue = profitFactor;
        else if (displayType === 'trade_expectancy') displayValue = tradeExpectancy;
        else if (displayType === 'avg_net_trade_pnl') displayValue = avgNetTradePnl;
        else if (displayType === 'avg_realized_r') displayValue = riskDrawdownStats.avgRealizedR;
        else if (displayType === 'avg_planned_r') displayValue = riskDrawdownStats.avgPlannedR;
        else if (displayType === 'avg_daily_drawdown') displayValue = riskDrawdownStats.avgDailyDrawdown;
        else if (displayType === 'largest_daily_loss') displayValue = riskDrawdownStats.largestDailyLoss;
        else if (displayType === 'winning_days_count') displayValue = riskDrawdownStats.winningDaysCount;
        else if (displayType === 'losing_days_count') displayValue = riskDrawdownStats.losingDaysCount;
        else if (displayType === 'breakeven_days_count') displayValue = riskDrawdownStats.breakevenDaysCount;

        return {
          label,
          sortOrder: d.sortOrder,
          totalPnl: d.totalPnl,
          totalPercent: returnPercent,
          tradeCount: d.tradeCount,
          winCount: d.winCount,
          lossCount: d.lossCount,
          breakevenCount: d.breakevenCount,
          winrate,
          displayValue,
          avgHoldTimeMinutes,
          longestDurationMinutes,
          longWinCount: d.longWinCount,
          longLossCount: d.longLossCount,
          longWinrate,
          shortWinCount: d.shortWinCount,
          shortLossCount: d.shortLossCount,
          shortWinrate,
          longTradeCount: d.longTradeCount,
          shortTradeCount: d.shortTradeCount,
          avgWin,
          avgLoss,
          largestWin,
          largestLoss,
          winPnlSum: d.winPnlSum,
          lossPnlSum: d.lossPnlSum,
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
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return data;
  }, [filteredTrades, displayType, bucketSize, totalStartingBalance, classifyTradeOutcome, breakevenTolerance]);

  const isMultiMetric = selectedMetrics.length > 1;
  const multiMetricChartData = useMemo(() => {
    if (!isMultiMetric) return durationData;
    return durationData.map(item => {
      const enhanced: Record<string, unknown> = { ...item };
      selectedMetrics.forEach((metric, index) => {
        enhanced[`metric_${index}`] = getMetricValue(item, metric);
      });
      return enhanced;
    });
  }, [durationData, selectedMetrics, isMultiMetric]);

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

  const formatValue = (value: number, type: ChartDisplayType = displayType): string => {
    if (type === 'percent') return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    if (type === 'winrate') return `${value.toFixed(2)}%`;
    if (type === 'tradecount') return `${Math.round(value)}`;
    if (type === 'tickpip') return `${value >= 0 ? '+' : ''}${value.toFixed(2)} T`;
    if (type === 'privacy') return '•••••';
    const absValue = Math.abs(value);
    if (absValue >= 1000) return `${value >= 0 ? '+' : '-'}${currencyConfig.symbol}${(absValue / 1000).toFixed(1)}k`;
    return `${value >= 0 ? '+' : '-'}${currencyConfig.symbol}${absValue.toFixed(2)}`;
  };

  // X-axis is dense for fine buckets; angle labels for compact display
  const isDenseBuckets = bucketSize === '5min' || bucketSize === '15min' || bucketSize === '30min';

  return (
    <Card className="bg-card border-border h-full">
      <CardContent className="p-4 pb-2">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <div className="flex items-center gap-2">
              <ChartMetricSettingsPopover metrics={selectedMetrics} configs={metricConfigs} onConfigChange={updateMetricConfig} />
            </div>
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

            <Select value={bucketSize} onValueChange={(v) => setBucketSize(v as BucketSizeType)}>
              <SelectTrigger className="w-[160px] bg-background border-border h-auto py-1.5">
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-muted-foreground">Bucket Size</span>
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="preset">Default Preset</SelectItem>
                <SelectItem value="5min">5 Minutes</SelectItem>
                <SelectItem value="15min">15 Minutes</SelectItem>
                <SelectItem value="30min">30 Minutes</SelectItem>
                <SelectItem value="1hour">1 Hour</SelectItem>
                <SelectItem value="2hour">2 Hours</SelectItem>
                <SelectItem value="4hour">4 Hours</SelectItem>
                <SelectItem value="1day">1 Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Legend */}
          {isMultiMetric ? (
            <div className="flex items-center gap-3 flex-wrap">
              {selectedMetrics.map((metric, index) => (
                <div key={`legend-${metric}-${index}`} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: getMetricColor(index) }} />
                  <span className="text-xs text-muted-foreground">{getDisplayLabel(metric)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-profit" />
                <span className="text-xs text-muted-foreground">Profit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-loss" />
                <span className="text-xs text-muted-foreground">Loss</span>
              </div>
            </div>
          )}
        </div>

        <div className={`w-full -mx-2 px-0 ${isMultiMetric ? 'h-[340px]' : 'h-[300px]'}`}>
          {durationData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={isMultiMetric ? multiMetricChartData : durationData}
                margin={{ top: 10, right: isMultiMetric ? (selectedMetrics.length === 3 ? 25 : 20) : -5, left: -10, bottom: isMultiMetric ? 30 : 20 }}
              >
                <Customized component={() => <ChartGradientDefs direction="vertical" idPrefix="durationPerf" />} />
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  dy={5}
                  interval={isDenseBuckets ? 'preserveStartEnd' : 0}
                  angle={isDenseBuckets ? -45 : 0}
                  textAnchor={isDenseBuckets ? 'end' : 'middle'}
                  height={isDenseBuckets ? 50 : 25}
                />

                {isMultiMetric ? (
                  <>
                    {selectedMetrics.map((metric, index) => (
                      <YAxis key={metric} yAxisId={`y-${index}`} orientation={index === 0 ? 'left' : 'right'} axisLine={{ stroke: getMetricColor(index) }} tickLine={false} tick={{ fill: getMetricColor(index), fontSize: 10 }} tickFormatter={(value) => formatMetricTick(value, metric)} width={index === 0 ? 40 : 32} />
                    ))}
                  </>
                ) : (
                  <YAxis axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(value) => formatMetricTick(value, displayType)} width={50} />
                )}

                {!isMultiMetric && (displayType === 'dollar' || displayType === 'percent' || displayType === 'avg_win' || displayType === 'avg_loss' || displayType === 'largest_win' || displayType === 'largest_loss' || displayType === 'trade_expectancy' || displayType === 'avg_net_trade_pnl' || displayType === 'avg_daily_drawdown' || displayType === 'largest_daily_loss' || displayType === 'avg_realized_r' || displayType === 'avg_planned_r') && (
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" />
                )}

                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const data = payload[0].payload as DurationData;

                    if (displayType === 'tradecount') {
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50">
                          <p className="text-foreground font-medium mb-2">{data.label}</p>
                          <p className="text-sm text-foreground">Trade Count: {data.tradeCount}</p>
                        </div>
                      );
                    }
                    if (displayType === 'avg_hold_time') {
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50">
                          <p className="text-foreground font-medium mb-2">{data.label}</p>
                          <div className="space-y-1 text-sm">
                            <p className="text-foreground">Avg Hold Time: {formatDuration(data.avgHoldTimeMinutes)}</p>
                            <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                          </div>
                        </div>
                      );
                    }
                    if (displayType === 'longest_duration') {
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50">
                          <p className="text-foreground font-medium mb-2">{data.label}</p>
                          <div className="space-y-1 text-sm">
                            <p className="text-foreground">Longest Duration: {formatDuration(data.longestDurationMinutes)}</p>
                            <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                          </div>
                        </div>
                      );
                    }
                    if (displayType === 'winrate') {
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50">
                          <p className="text-foreground font-medium mb-2">{data.label}</p>
                          <div className="space-y-1 text-sm">
                            <p className="text-foreground">Winrate: {data.winrate.toFixed(1)}%</p>
                            <p className="text-muted-foreground">Wins: {data.winCount}</p>
                            <p className="text-muted-foreground">Losses: {data.lossCount}</p>
                            <p className="text-muted-foreground">Breakeven: {data.breakevenCount}</p>
                          </div>
                        </div>
                      );
                    }
                    if (displayType === 'profit_factor') {
                      const pfDisplay = data.profitFactor === Infinity ? '∞' : data.profitFactor.toFixed(2);
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50">
                          <p className="text-foreground font-medium mb-2">{data.label}</p>
                          <div className="space-y-1 text-sm">
                            <p className="text-foreground">Profit Factor: {isPrivacyMode ? '**' : pfDisplay}</p>
                            <p className="text-profit">Gross Profit: {isPrivacyMode ? '**' : `+${currencyConfig.symbol}${data.grossProfit.toFixed(2)}`}</p>
                            <p className="text-loss">Gross Loss: {isPrivacyMode ? '**' : `-${currencyConfig.symbol}${data.grossLoss.toFixed(2)}`}</p>
                            <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                          </div>
                        </div>
                      );
                    }
                    if (displayType === 'trade_expectancy') {
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50">
                          <p className="text-foreground font-medium mb-2">{data.label}</p>
                          <div className="space-y-1 text-sm">
                            <p className={data.tradeExpectancy >= 0 ? 'text-profit' : 'text-loss'}>
                              Trade Expectancy: {isPrivacyMode ? '**' : `${data.tradeExpectancy >= 0 ? '+' : ''}${currencyConfig.symbol}${data.tradeExpectancy.toFixed(2)}`}
                            </p>
                            <p className="text-muted-foreground">Win Rate: {data.winrate.toFixed(1)}%</p>
                          </div>
                        </div>
                      );
                    }
                    if (displayType === 'percent') {
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50">
                          <p className="text-foreground font-medium mb-2">{data.label}</p>
                          <div className="space-y-1 text-sm">
                            <p className={isPrivacyMode ? 'text-foreground' : data.totalPercent >= 0 ? 'text-profit' : 'text-loss'}>
                              Return %: {isPrivacyMode ? '**' : formatValue(data.totalPercent, 'percent')}
                            </p>
                            <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                            <p className="text-muted-foreground">Winners: {data.winCount}</p>
                            <p className="text-muted-foreground">Losers: {data.lossCount}</p>
                          </div>
                        </div>
                      );
                    }
                    // Default: dollar / generic
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg z-50">
                        <p className="text-foreground font-medium mb-2">{data.label}</p>
                        <div className="space-y-1 text-sm">
                          <p className={isPrivacyMode ? 'text-foreground' : data.totalPnl >= 0 ? 'text-profit' : 'text-loss'}>
                            Net PNL: {isPrivacyMode ? '**' : formatValue(data.totalPnl, 'dollar')}
                          </p>
                          <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                          <p className="text-muted-foreground">Winners: {data.winCount}</p>
                          <p className="text-muted-foreground">Losers: {data.lossCount}</p>
                          <p className="text-muted-foreground">BE: {data.breakevenCount}</p>
                        </div>
                      </div>
                    );
                  }}
                />

                {isMultiMetric && (
                  <Legend
                    verticalAlign="bottom"
                    height={24}
                    content={() => (
                      <div className="flex flex-wrap items-center justify-center gap-4 mt-1">
                        {selectedMetrics.map((metric, index) => {
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
                        })}
                      </div>
                    )}
                  />
                )}

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
                      const isPnlMetric = metric === 'dollar' || metric === 'percent' || metric === 'avg_win' || metric === 'avg_loss' || metric === 'largest_win' || metric === 'largest_loss' || metric === 'trade_expectancy' || metric === 'avg_net_trade_pnl' || metric === 'avg_daily_drawdown' || metric === 'largest_daily_loss' || metric === 'avg_realized_r' || metric === 'avg_planned_r';
                      const useSplitColors = isPnlMetric && color === DEFAULT_METRIC_COLORS[index];
                      if (useSplitColors) {
                        return (
                          <Bar key={`bar-${metric}-${index}`} yAxisId={`y-${index}`} dataKey={`metric_${index}`} radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {multiMetricChartData.map((entry, i) => (
                              <Cell key={`cell-${metric}-${i}`} fill={getFill((entry[`metric_${index}`] as number) >= 0)} />
                            ))}
                          </Bar>
                        );
                      }
                      return (
                        <Bar key={`bar-${metric}-${index}`} yAxisId={`y-${index}`} dataKey={`metric_${index}`} fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
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
                  <Bar dataKey="displayValue" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    {durationData.map((entry, index) => {
                      const config = metricConfigs[0];
                      const isPnlMetric = displayType === 'dollar' || displayType === 'percent' || displayType === 'avg_win' || displayType === 'avg_loss' || displayType === 'largest_win' || displayType === 'largest_loss' || displayType === 'trade_expectancy' || displayType === 'avg_net_trade_pnl' || displayType === 'avg_daily_drawdown' || displayType === 'largest_daily_loss' || displayType === 'avg_realized_r' || displayType === 'avg_planned_r';
                      let fillColor: string;
                      if (isPnlMetric) {
                        fillColor = getFill(entry.displayValue >= 0);
                      } else if (config?.color && config.color !== DEFAULT_METRIC_COLORS[0]) {
                        fillColor = config.color;
                      } else if (displayType === 'tradecount' || displayType === 'avg_hold_time' || displayType === 'longest_duration' || displayType === 'long_winrate' || displayType === 'short_winrate' || displayType === 'tradecount_long' || displayType === 'tradecount_short') {
                        fillColor = primaryFill;
                      } else if (displayType === 'winrate') {
                        fillColor = getFill(entry.displayValue >= 50);
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
              <p className="text-muted-foreground text-sm">No closed trades available.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
