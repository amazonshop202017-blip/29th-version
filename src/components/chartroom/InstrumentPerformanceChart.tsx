import { useMemo, useState } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode, PRIVACY_MASK } from '@/hooks/usePrivacyMode';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { ChartDisplayType, mapGlobalToChartDisplay, formatDuration, formatDurationTick, getDisplayLabel } from '@/hooks/useChartDisplayMode';
import { buildGroupDailyCounts, getGroupTradingActivityStats } from '@/lib/tradingActivityStats';
import { buildGroupedTradesMap, getGroupRiskDrawdownStats } from '@/lib/riskDrawdownStats';
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
import { Card, CardContent } from '@/components/ui/card';
import { ChartDisplayDropdown } from './ChartDisplayDropdown';
import { ChartMetricSettingsPopover, MetricConfig } from './ChartMetricSettingsPopover';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { ChartGradientDefs, useGradientFill } from '@/components/charts/ChartGradientDefs';

interface InstrumentData {
  symbol: string;
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

const DEFAULT_METRIC_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--profit))',
  'hsl(45 93% 47%)',
];

const getMetricValue = (data: InstrumentData, metric: ChartDisplayType): number => {
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

interface InstrumentPerformanceChartProps {
  defaultDisplayType?: ChartDisplayType;
  title?: string;
  useGlobalDefault?: boolean;
}

export const InstrumentPerformanceChart = ({ 
  defaultDisplayType = 'dollar',
  title = 'Performance by Symbol',
  useGlobalDefault = true
}: InstrumentPerformanceChartProps) => {
  const { filteredTrades } = useFilteredTrades();
  const { currencyConfig, selectedAccounts, isAllAccountsSelected, classifyTradeOutcome, displayMode, breakevenTolerance } = useGlobalFilters();
  const { isPrivacyMode } = usePrivacyMode();
  const { accounts, getAccountBalanceBeforeTrades } = useAccountsContext();
  const { getFill, primaryFill } = useGradientFill('instrPerf');
  
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
  const displayType = selectedMetrics[0]; // Primary metric for backward compat

  // Helper to get color for a metric index
  const getMetricColor = (index: number) => metricConfigs[index]?.color || DEFAULT_METRIC_COLORS[index] || DEFAULT_METRIC_COLORS[0];

  // Update metric configs when metrics are added/removed
  const updateMetricConfig = (index: number, partial: Partial<MetricConfig>) => {
    setMetricConfigs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  };

  // Calculate total starting balance for Return (%) denominator
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

  // Calculate instrument data
  const instrumentData = useMemo(() => {
    // Include both open and closed trades for trading activity stats
    const allTrades = filteredTrades;
    const closedTrades = filteredTrades.filter((trade: Trade) => {
      const metrics = calculateTradeMetrics(trade);
      return metrics.positionStatus === 'CLOSED';
    });

    if (closedTrades.length === 0) return [];

    // Build daily counts per symbol for trading activity metrics
    const groupDailyCounts = buildGroupDailyCounts(allTrades, (trade) => trade.symbol.toUpperCase());
    
    // Build grouped trades map for Risk & Drawdown calculations
    const groupedTradesMap = buildGroupedTradesMap(closedTrades, (trade) => trade.symbol.toUpperCase());
    const instrumentMap = new Map<string, {
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

    closedTrades.forEach(trade => {
      const metrics = calculateTradeMetrics(trade);
      const normalizedSymbol = trade.symbol.toUpperCase();
      
      const existing = instrumentMap.get(normalizedSymbol) || { 
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
      
      // Use global classifyTradeOutcome for consistent classification
      const outcome = classifyTradeOutcome(metrics.netPnl, trade.savedReturnPercent, trade.breakEven);
      const durationMinutes = metrics.durationMinutes || 0;
      const isLong = trade.side === 'LONG';
      const isShort = trade.side === 'SHORT';
      const isWin = outcome === 'win';
      const isLoss = outcome === 'loss';
      const pnl = metrics.netPnl;
      
      instrumentMap.set(normalizedSymbol, {
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

    // Convert to array and calculate averages
    const data: InstrumentData[] = Array.from(instrumentMap.entries())
      .map(([symbol, data]) => {
        // Win Rate = Wins / (Wins + Losses) - excludes breakeven
        const winsAndLosses = data.winCount + data.lossCount;
        const winrate = winsAndLosses > 0 ? (data.winCount / winsAndLosses) * 100 : 0;
        // Calculate Return (%) correctly: Total P/L ÷ Account Starting Balance × 100
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
            displayValue = getGroupTradingActivityStats(groupDailyCounts, symbol).avgTradesPerDay;
            break;
          case 'median_trades_per_day':
            displayValue = getGroupTradingActivityStats(groupDailyCounts, symbol).medianTradesPerDay;
            break;
          case '90th_percentile_trades':
            displayValue = getGroupTradingActivityStats(groupDailyCounts, symbol).percentile90TradesPerDay;
            break;
          case 'logged_days':
            displayValue = getGroupTradingActivityStats(groupDailyCounts, symbol).loggedDays;
            break;
          case 'profit_factor':
            // Profit Factor = Gross Profit / |Gross Loss| (guard: 0 when grossLoss is 0 to prevent Infinity)
            displayValue = Math.abs(data.lossPnlSum) > 0 ? data.winPnlSum / Math.abs(data.lossPnlSum) : 0;
            break;
          case 'trade_expectancy':
            // Trade Expectancy = (Win% × Avg Win) - (Loss% × |Avg Loss|)
            const winPct = data.tradeCount > 0 ? data.winCount / data.tradeCount : 0;
            const lossPct = data.tradeCount > 0 ? data.lossCount / data.tradeCount : 0;
            displayValue = (winPct * avgWin) - (lossPct * Math.abs(avgLoss));
            break;
          case 'avg_net_trade_pnl':
            // Avg Net P&L per Trade = Net P&L / Total Trades
            displayValue = data.tradeCount > 0 ? data.totalPnl / data.tradeCount : 0;
            break;
          case 'avg_realized_r':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, symbol, breakevenTolerance).avgRealizedR;
            break;
          case 'avg_planned_r':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, symbol, breakevenTolerance).avgPlannedR;
            break;
          case 'avg_daily_drawdown':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, symbol, breakevenTolerance).avgDailyDrawdown;
            break;
          case 'largest_daily_loss':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, symbol, breakevenTolerance).largestDailyLoss;
            break;
          case 'winning_days_count':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, symbol, breakevenTolerance).winningDaysCount;
            break;
          case 'losing_days_count':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, symbol, breakevenTolerance).losingDaysCount;
            break;
          case 'breakeven_days_count':
            displayValue = getGroupRiskDrawdownStats(groupedTradesMap, symbol, breakevenTolerance).breakevenDaysCount;
            break;
          default:
            displayValue = data.totalPnl;
        }
        
        // Get trading activity stats for this symbol
        const tradingActivityStats = getGroupTradingActivityStats(groupDailyCounts, symbol);
        
        // Calculate profitability metrics
        const grossProfit = data.winPnlSum;
        const grossLoss = Math.abs(data.lossPnlSum);
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        const avgNetTradePnl = data.tradeCount > 0 ? data.totalPnl / data.tradeCount : 0;
        const winPctForExp = data.tradeCount > 0 ? data.winCount / data.tradeCount : 0;
        const lossPctForExp = data.tradeCount > 0 ? data.lossCount / data.tradeCount : 0;
        const tradeExpectancy = (winPctForExp * avgWin) - (lossPctForExp * Math.abs(avgLoss));
        
        // Get Risk & Drawdown stats for this symbol
        const riskDrawdownStats = getGroupRiskDrawdownStats(groupedTradesMap, symbol, breakevenTolerance);
        
        return {
          symbol,
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
      // Sort by value descending (best first)
      .sort((a, b) => b.displayValue - a.displayValue);

    return data;
  }, [filteredTrades, displayType, totalStartingBalance, classifyTradeOutcome]);

  // Build multi-metric chart data
  const isMultiMetric = selectedMetrics.length > 1;
  const multiMetricChartData = useMemo(() => {
    if (!isMultiMetric) return instrumentData;
    return instrumentData.map(item => {
      const enhanced: Record<string, unknown> = { ...item };
      selectedMetrics.forEach((metric, index) => {
        enhanced[`metric_${index}`] = getMetricValue(item, metric);
      });
      return enhanced;
    });
  }, [instrumentData, selectedMetrics, isMultiMetric]);

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

  // Format currency
  // Format Y-axis tick for a given metric type
  const formatMetricTick = (value: number, metricType: ChartDisplayType): string => {
    if (isPrivacyMode && ['dollar', 'percent', 'avg_win', 'avg_loss', 'largest_win', 'largest_loss', 'trade_expectancy', 'avg_net_trade_pnl', 'profit_factor', 'avg_daily_drawdown', 'largest_daily_loss'].includes(metricType)) {
      return PRIVACY_MASK;
    }
    switch (metricType) {
      case 'dollar':
      case 'avg_win':
      case 'avg_loss':
      case 'largest_win':
      case 'largest_loss':
      case 'trade_expectancy':
      case 'avg_net_trade_pnl':
      case 'avg_daily_drawdown':
      case 'largest_daily_loss':
        return `${currencyConfig.symbol}${value.toFixed(0)}`;
      case 'percent':
      case 'winrate':
      case 'long_winrate':
      case 'short_winrate':
        return `${value.toFixed(0)}%`;
      case 'tradecount':
      case 'tradecount_long':
      case 'tradecount_short':
      case 'avg_trades_per_day':
      case 'median_trades_per_day':
      case '90th_percentile_trades':
      case 'logged_days':
      case 'winning_days_count':
      case 'losing_days_count':
      case 'breakeven_days_count':
        return value % 1 === 0 ? `${Math.round(value)}` : value.toFixed(1);
      case 'avg_hold_time':
      case 'longest_duration':
        return formatDurationTick(value);
      case 'profit_factor':
        return value === Infinity ? '∞' : value.toFixed(2);
      case 'avg_realized_r':
      case 'avg_planned_r':
        return value.toFixed(2);
      default:
        return `${value}`;
    }
  };

  const formatValue = (value: number, forceType?: ChartDisplayType): string => {
    const type = forceType || displayType;
    if (type === 'percent') {
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    }
    if (type === 'tickpip') {
      // Placeholder for tick/pip display
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)} T`;
    }
    if (type === 'privacy') {
      return '•••••';
    }
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      return `${value >= 0 ? '+' : '-'}${currencyConfig.symbol}${(absValue / 1000).toFixed(1)}k`;
    }
    return `${value >= 0 ? '+' : '-'}${currencyConfig.symbol}${absValue.toFixed(2)}`;
  };

  return (
    <Card className="bg-card border-border h-full">
      <CardContent className="p-4 pb-2">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <ChartMetricSettingsPopover
              metrics={selectedMetrics}
              configs={metricConfigs}
              onConfigChange={updateMetricConfig}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedMetrics.map((metric, index) => (
              <div key={`${metric}-${index}`} className="flex items-center gap-1.5">
                {isMultiMetric && (
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getMetricColor(index) }} />
                )}
                <ChartDisplayDropdown
                  value={metric}
                  onValueChange={(v) => {
                    const next = [...selectedMetrics];
                    next[index] = v;
                    setSelectedMetrics(next);
                  }}
                  disabledValues={selectedMetrics.filter((_, i) => i !== index)}
                />
                {selectedMetrics.length > 1 && (
                  <button
                    onClick={() => removeMetric(index)}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {selectedMetrics.length < 3 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={addMetric}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Metric
              </Button>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className={`w-full -mx-2 px-0 ${isMultiMetric ? 'h-[340px]' : 'h-[300px]'}`}>
          {instrumentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={isMultiMetric ? multiMetricChartData : instrumentData}
                  margin={{ top: 10, right: -5, left: -10, bottom: isMultiMetric ? 30 : 5 }}
                >
                  <Customized component={() => <ChartGradientDefs direction="vertical" idPrefix="instrPerf" />} />
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="hsl(var(--border))" 
                    opacity={0.3}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="symbol"
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    dy={5}
                  />
                  
                  {isMultiMetric ? (
                    <>
                      {selectedMetrics.map((metric, index) => (
                        <YAxis
                          key={metric}
                          yAxisId={`y-${index}`}
                          orientation={index === 0 ? 'left' : 'right'}
                          axisLine={{ stroke: getMetricColor(index) }}
                          tickLine={false}
                          tick={{ fill: getMetricColor(index), fontSize: 10 }}
                          tickFormatter={(value) => formatMetricTick(value, metric)}
                          width={index === 0 ? 40 : 32}
                        />
                      ))}
                    </>
                  ) : (
                    <YAxis
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      tickFormatter={(value) => formatMetricTick(value, displayType)}
                      width={50}
                    />
                  )}
                  
                  {!isMultiMetric && (displayType === 'dollar' || displayType === 'percent' || displayType === 'avg_win' || displayType === 'avg_loss' || displayType === 'largest_win' || displayType === 'largest_loss' || displayType === 'trade_expectancy' || displayType === 'avg_net_trade_pnl' || displayType === 'avg_daily_drawdown' || displayType === 'largest_daily_loss' || displayType === 'avg_realized_r' || displayType === 'avg_planned_r') && (
                    <ReferenceLine 
                      y={0} 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  )}

                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload as InstrumentData;

                      // Multi-metric tooltip
                      if (isMultiMetric) {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1.5 text-sm">
                              {selectedMetrics.map((metric, index) => {
                                const val = getMetricValue(data, metric);
                                return (
                                  <div key={metric} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getMetricColor(index) }} />
                                    <span className="text-muted-foreground">{getDisplayLabel(metric)}:</span>
                                    <span className="text-foreground font-mono">
                                      {isPrivacyMode ? PRIVACY_MASK : typeof val === 'number' ? val.toFixed(2) : val}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // Single metric tooltips (existing behavior)
                      if (displayType === 'tradecount') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <p className="text-sm text-foreground">Trade Count: {data.tradeCount}</p>
                          </div>
                        );
                      }
                      if (displayType === 'avg_hold_time') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Avg Hold Time: {formatDuration(data.avgHoldTimeMinutes)}</p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'longest_duration') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Longest Duration: {formatDuration(data.longestDurationMinutes)}</p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'winrate') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Winrate: {data.winrate.toFixed(1)}%</p>
                              <p className="text-muted-foreground">Wins: {data.winCount}</p>
                              <p className="text-muted-foreground">Losses: {data.lossCount}</p>
                              <p className="text-muted-foreground">Breakeven: {data.beCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'long_winrate') {
                        const longTotal = data.longWinCount + data.longLossCount;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Long Win %: {data.longWinrate.toFixed(1)}%</p>
                              <p className="text-muted-foreground">Long Wins: {data.longWinCount}</p>
                              <p className="text-muted-foreground">Long Losses: {data.longLossCount}</p>
                              <p className="text-muted-foreground">Total Long Trades: {longTotal}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'short_winrate') {
                        const shortTotal = data.shortWinCount + data.shortLossCount;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Short Win %: {data.shortWinrate.toFixed(1)}%</p>
                              <p className="text-muted-foreground">Short Wins: {data.shortWinCount}</p>
                              <p className="text-muted-foreground">Short Losses: {data.shortLossCount}</p>
                              <p className="text-muted-foreground">Total Short Trades: {shortTotal}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'tradecount_long') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Trade Count (Long): {data.longTradeCount}</p>
                              <p className="text-muted-foreground">Direction: Long</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'tradecount_short') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Trade Count (Short): {data.shortTradeCount}</p>
                              <p className="text-muted-foreground">Direction: Short</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'avg_win') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.avgWin >= 0 ? 'text-profit' : 'text-foreground'}>
                                Avg Win: {isPrivacyMode ? PRIVACY_MASK : `${currencyConfig.symbol}${data.avgWin.toFixed(2)}`}
                              </p>
                              <p className="text-muted-foreground">Winning Trades: {data.winCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'avg_loss') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.avgLoss < 0 ? 'text-loss' : 'text-foreground'}>
                                Avg Loss: {isPrivacyMode ? PRIVACY_MASK : `${data.avgLoss < 0 ? '-' : ''}${currencyConfig.symbol}${Math.abs(data.avgLoss).toFixed(2)}`}
                              </p>
                              <p className="text-muted-foreground">Losing Trades: {data.lossCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'largest_win') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.largestWin >= 0 ? 'text-profit' : 'text-foreground'}>
                                Largest Win: {isPrivacyMode ? PRIVACY_MASK : `${currencyConfig.symbol}${data.largestWin.toFixed(2)}`}
                              </p>
                              <p className="text-muted-foreground">Winning Trades: {data.winCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'largest_loss') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.largestLoss < 0 ? 'text-loss' : 'text-foreground'}>
                                Largest Loss: {isPrivacyMode ? PRIVACY_MASK : `${data.largestLoss < 0 ? '-' : ''}${currencyConfig.symbol}${Math.abs(data.largestLoss).toFixed(2)}`}
                              </p>
                              <p className="text-muted-foreground">Losing Trades: {data.lossCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'avg_trades_per_day') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Avg Trades/Day: {data.avgTradesPerDay.toFixed(1)}</p>
                              <p className="text-muted-foreground">Logged Days: {data.loggedDays}</p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'median_trades_per_day') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Median Trades/Day: {data.medianTradesPerDay.toFixed(1)}</p>
                              <p className="text-muted-foreground">Logged Days: {data.loggedDays}</p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === '90th_percentile_trades') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">90th Percentile Trades / Day: {Math.round(data.percentile90TradesPerDay)}</p>
                              <p className="text-muted-foreground">Median Trades / Day: {data.medianTradesPerDay.toFixed(1)}</p>
                              <p className="text-muted-foreground">Max Trades in a Day: {data.maxTradesInDay}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'logged_days') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Logged Days: {data.loggedDays}</p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'profit_factor') {
                        const pfDisplay = data.profitFactor === Infinity ? '∞' : data.profitFactor.toFixed(2);
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Profit Factor: {isPrivacyMode ? PRIVACY_MASK : pfDisplay}</p>
                              <p className={data.grossProfit >= 0 ? 'text-profit' : 'text-foreground'}>
                                Gross Profit: {isPrivacyMode ? PRIVACY_MASK : `+${currencyConfig.symbol}${data.grossProfit.toFixed(2)}`}
                              </p>
                              <p className="text-loss">
                                Gross Loss: {isPrivacyMode ? PRIVACY_MASK : `-${currencyConfig.symbol}${data.grossLoss.toFixed(2)}`}
                              </p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'avg_net_trade_pnl') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.avgNetTradePnl >= 0 ? 'text-profit' : 'text-loss'}>
                                Avg Net P&L / Trade: {isPrivacyMode ? PRIVACY_MASK : `${data.avgNetTradePnl >= 0 ? '+' : ''}${currencyConfig.symbol}${data.avgNetTradePnl.toFixed(2)}`}
                              </p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'trade_expectancy') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.tradeExpectancy >= 0 ? 'text-profit' : 'text-loss'}>
                                Trade Expectancy: {isPrivacyMode ? PRIVACY_MASK : `${data.tradeExpectancy >= 0 ? '+' : ''}${currencyConfig.symbol}${data.tradeExpectancy.toFixed(2)}`}
                              </p>
                              <p className="text-muted-foreground">Win Rate: {data.winrate.toFixed(1)}%</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'avg_realized_r') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.avgRealizedR >= 0 ? 'text-profit' : 'text-loss'}>
                                Avg Realized R: {data.avgRealizedR.toFixed(2)}
                              </p>
                              <p className="text-muted-foreground">Total Trades: {data.tradesWithRealizedR}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'avg_planned_r') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Avg Planned R: {data.avgPlannedR.toFixed(2)}</p>
                              <p className="text-muted-foreground">Total Trades: {data.tradesWithPlannedR}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'avg_daily_drawdown') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-loss">
                                Avg Daily Net Drawdown: {isPrivacyMode ? PRIVACY_MASK : `${currencyConfig.symbol}${data.avgDailyDrawdown.toFixed(2)}`}
                              </p>
                              <p className="text-muted-foreground">Losing Days: {data.losingDaysCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'largest_daily_loss') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-loss">
                                Largest Daily Loss: {isPrivacyMode ? PRIVACY_MASK : `${currencyConfig.symbol}${data.largestDailyLoss.toFixed(2)}`}
                              </p>
                              {data.largestDailyLossDate && (
                                <p className="text-muted-foreground">Date: {data.largestDailyLossDate}</p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'winning_days_count') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-profit">Winning Days: {data.winningDaysCount}</p>
                              <p className="text-muted-foreground">Total Logged Days: {data.loggedDays}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'losing_days_count') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-loss">Losing Days: {data.losingDaysCount}</p>
                              <p className="text-muted-foreground">Total Logged Days: {data.loggedDays}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'breakeven_days_count') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground">Breakeven Days: {data.breakevenDaysCount}</p>
                              <p className="text-muted-foreground">Total Logged Days: {data.loggedDays}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'dollar') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.totalPnl >= 0 ? 'text-profit' : 'text-loss'}>
                                Net PNL: {formatValue(data.totalPnl, 'dollar')}
                              </p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                              <p className="text-muted-foreground">Winners: {data.winCount}</p>
                              <p className="text-muted-foreground">Losers: {data.lossCount}</p>
                              <p className="text-muted-foreground">BE: {data.beCount}</p>
                            </div>
                          </div>
                        );
                      }
                      if (displayType === 'percent') {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                            <div className="space-y-1 text-sm">
                              <p className={data.totalPercent >= 0 ? 'text-profit' : 'text-loss'}>
                                Return %: {formatValue(data.totalPercent, 'percent')}
                              </p>
                              <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
                              <p className="text-muted-foreground">Winners: {data.winCount}</p>
                              <p className="text-muted-foreground">Losers: {data.lossCount}</p>
                              <p className="text-muted-foreground">BE: {data.beCount}</p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                          <p className="text-foreground font-medium mb-2">{data.symbol}</p>
                          <div className="space-y-1 text-sm">
                            <p className="text-foreground">{displayType === 'privacy' ? '•••••' : '--'}</p>
                            <p className="text-muted-foreground">Total Trades: {data.tradeCount}</p>
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
                            <Line
                              key={metric}
                              yAxisId={`y-${index}`}
                              type="monotone"
                              dataKey={`metric_${index}`}
                              name={getDisplayLabel(metric)}
                              stroke={color}
                              strokeWidth={2}
                              dot={{ fill: color, r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          );
                        }
                        return (
                          <Bar
                            key={metric}
                            yAxisId={`y-${index}`}
                            dataKey={`metric_${index}`}
                            name={getDisplayLabel(metric)}
                            fill={color}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={30}
                          />
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
                    <Bar
                      dataKey="displayValue" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    >
                      {instrumentData.map((entry, index) => {
                        const customColor = metricConfigs[0]?.color;
                        const isPnlMetric = displayType === 'dollar' || displayType === 'percent' || displayType === 'avg_win' || displayType === 'avg_loss' || displayType === 'largest_win' || displayType === 'largest_loss' || displayType === 'trade_expectancy' || displayType === 'avg_net_trade_pnl' || displayType === 'avg_daily_drawdown' || displayType === 'largest_daily_loss' || displayType === 'avg_realized_r' || displayType === 'avg_planned_r';
                        let fillColor: string;
                        if (isPnlMetric) {
                          fillColor = getFill(entry.displayValue >= 0);
                        } else if (customColor && customColor !== DEFAULT_METRIC_COLORS[0]) {
                          fillColor = customColor;
                        } else if (displayType === 'winrate' || displayType === 'tradecount' || displayType === 'avg_hold_time' || displayType === 'longest_duration' || displayType === 'long_winrate' || displayType === 'short_winrate' || displayType === 'tradecount_long' || displayType === 'tradecount_short') {
                          fillColor = primaryFill;
                        } else {
                          fillColor = getFill(entry.displayValue >= 0);
                        }
                        return (
                          <Cell 
                            key={`cell-${index}`}
                            fill={fillColor}
                          />
                        );
                      })}
                    </Bar>
                  )}
                </ComposedChart>
              </ResponsiveContainer>

            </>
          ) : (
            <div className="flex items-center justify-center h-full border border-dashed border-border rounded-xl bg-muted/20">
              <p className="text-muted-foreground text-sm">No closed trades available for analysis.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
