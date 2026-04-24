import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode, PRIVACY_MASK } from '@/hooks/usePrivacyMode';
import { useChartDisplayMode, ChartDisplayType, getDisplayLabel } from '@/hooks/useChartDisplayMode';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Customized,
} from 'recharts';
import { ChartGradientDefs, useGradientFill } from '@/components/charts/ChartGradientDefs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Streak {
  type: 'win' | 'loss';
  count: number;
  totalPnl: number;
  totalReturnPercent: number;
  trades: Trade[];
  startDate: string;
  endDate: string;
}

interface ChartDataPoint {
  streak: number;
  winAmount: number;
  lossAmount: number;
  winAmountPercent: number;
  lossAmountPercent: number;
  winFrequency: number;
  lossFrequency: number;
  // For single-bar rendering: [bottom (negative), top (positive)]
  barRange: [number, number];
  barRangePercent: [number, number];
}

const ConsecutiveWinnersLosers = () => {
  const { filteredTrades } = useFilteredTrades();
  const { formatCurrency, classifyTradeOutcome } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency } = usePrivacyMode();
  const { displayType, setDisplayType } = useChartDisplayMode('dollar', true);
  const { profitFill, lossFill } = useGradientFill('consec');

  // Filter to only dollar/percent for this chart
  const chartDisplayType = displayType === 'percent' ? 'percent' : 'dollar';

  // Calculate streaks from trades
  const { streaks, stats, chartData } = useMemo(() => {
    // Sort trades by open date
    const sortedTrades = [...filteredTrades]
      .map(trade => ({
        trade,
        metrics: calculateTradeMetrics(trade),
      }))
      .filter(t => t.metrics.openDate)
      .sort((a, b) => {
        const aTime = parseISO(a.metrics.openDate!).getTime();
        const bTime = parseISO(b.metrics.openDate!).getTime();
        return aTime - bTime;
      });

    if (sortedTrades.length === 0) {
      return { streaks: [], stats: null, chartData: [] };
    }

    // Build streaks
    const allStreaks: Streak[] = [];
    let currentStreak: Streak | null = null;

    sortedTrades.forEach(({ trade, metrics }) => {
      const isWin = metrics.netPnl > 0;
      const type = isWin ? 'win' : 'loss';
      const returnPercent = metrics.returnPercent || 0;

      if (!currentStreak || currentStreak.type !== type) {
        // Start new streak
        if (currentStreak) {
          allStreaks.push(currentStreak);
        }
        currentStreak = {
          type,
          count: 1,
          totalPnl: metrics.netPnl,
          totalReturnPercent: returnPercent,
          trades: [trade],
          startDate: metrics.openDate!,
          endDate: metrics.openDate!,
        };
      } else {
        // Continue streak
        currentStreak.count += 1;
        currentStreak.totalPnl += metrics.netPnl;
        currentStreak.totalReturnPercent += returnPercent;
        currentStreak.trades.push(trade);
        currentStreak.endDate = metrics.openDate!;
      }
    });

    // Push final streak
    if (currentStreak) {
      allStreaks.push(currentStreak);
    }

    // Calculate statistics
    const winStreaks = allStreaks.filter(s => s.type === 'win');
    const lossStreaks = allStreaks.filter(s => s.type === 'loss');

    const longestWinStreak = winStreaks.length > 0
      ? Math.max(...winStreaks.map(s => s.count))
      : 0;
    const longestLossStreak = lossStreaks.length > 0
      ? Math.max(...lossStreaks.map(s => s.count))
      : 0;
    const avgWinStreak = winStreaks.length > 0
      ? winStreaks.reduce((sum, s) => sum + s.count, 0) / winStreaks.length
      : 0;
    const avgLossStreak = lossStreaks.length > 0
      ? lossStreaks.reduce((sum, s) => sum + s.count, 0) / lossStreaks.length
      : 0;

    // Current streak
    const currentStreakInfo = allStreaks[allStreaks.length - 1] || null;

    const stats = {
      longestWinStreak,
      longestLossStreak,
      avgWinStreak,
      avgLossStreak,
      totalWinStreaks: winStreaks.length,
      totalLossStreaks: lossStreaks.length,
      currentStreak: currentStreakInfo,
    };

    // Chart data - aggregate by streak length
    const winDataByStreak: Record<number, { total: number; totalPercent: number; count: number }> = {};
    const lossDataByStreak: Record<number, { total: number; totalPercent: number; count: number }> = {};

    winStreaks.forEach(s => {
      if (!winDataByStreak[s.count]) {
        winDataByStreak[s.count] = { total: 0, totalPercent: 0, count: 0 };
      }
      winDataByStreak[s.count].total += s.totalPnl;
      winDataByStreak[s.count].totalPercent += s.totalReturnPercent;
      winDataByStreak[s.count].count += 1;
    });

    lossStreaks.forEach(s => {
      if (!lossDataByStreak[s.count]) {
        lossDataByStreak[s.count] = { total: 0, totalPercent: 0, count: 0 };
      }
      lossDataByStreak[s.count].total += s.totalPnl;
      lossDataByStreak[s.count].totalPercent += s.totalReturnPercent;
      lossDataByStreak[s.count].count += 1;
    });

    const maxStreak = Math.max(longestWinStreak, longestLossStreak, 1);
    const chartData: ChartDataPoint[] = [];
    
    for (let i = 1; i <= Math.min(maxStreak, 10); i++) {
      const winData = winDataByStreak[i];
      const lossData = lossDataByStreak[i];
      
      const winAvg = winData ? winData.total / winData.count : 0;
      const lossAvg = lossData ? lossData.total / lossData.count : 0;
      const winAvgPercent = winData ? winData.totalPercent / winData.count : 0;
      const lossAvgPercent = lossData ? lossData.totalPercent / lossData.count : 0;
      
      chartData.push({
        streak: i,
        winAmount: winAvg,
        lossAmount: lossAvg,
        winAmountPercent: winAvgPercent,
        lossAmountPercent: lossAvgPercent,
        winFrequency: winData ? winData.count : 0,
        lossFrequency: lossData ? lossData.count : 0,
        // barRange: [bottom (loss, negative), top (win, positive)]
        barRange: [lossAvg, winAvg],
        barRangePercent: [lossAvgPercent, winAvgPercent],
      });
    }

    // Add ">10" bucket if needed
    if (maxStreak > 10) {
      const winOver10 = winStreaks.filter(s => s.count > 10);
      const lossOver10 = lossStreaks.filter(s => s.count > 10);
      
      const winTotal = winOver10.reduce((sum, s) => sum + s.totalPnl, 0);
      const winTotalPercent = winOver10.reduce((sum, s) => sum + s.totalReturnPercent, 0);
      const lossTotal = lossOver10.reduce((sum, s) => sum + s.totalPnl, 0);
      const lossTotalPercent = lossOver10.reduce((sum, s) => sum + s.totalReturnPercent, 0);
      
      const winAvgOver10 = winOver10.length > 0 ? winTotal / winOver10.length : 0;
      const lossAvgOver10 = lossOver10.length > 0 ? lossTotal / lossOver10.length : 0;
      const winAvgPercentOver10 = winOver10.length > 0 ? winTotalPercent / winOver10.length : 0;
      const lossAvgPercentOver10 = lossOver10.length > 0 ? lossTotalPercent / lossOver10.length : 0;
      
      chartData.push({
        streak: 11, // Represents ">10"
        winAmount: winAvgOver10,
        lossAmount: lossAvgOver10,
        winAmountPercent: winAvgPercentOver10,
        lossAmountPercent: lossAvgPercentOver10,
        winFrequency: winOver10.length,
        lossFrequency: lossOver10.length,
        barRange: [lossAvgOver10, winAvgOver10],
        barRangePercent: [lossAvgPercentOver10, winAvgPercentOver10],
      });
    }

    return { streaks: allStreaks, stats, chartData };
  }, [filteredTrades]);

  // Get top streaks for table
  const topWinStreaks = useMemo(() => {
    return [...streaks]
      .filter(s => s.type === 'win')
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [streaks]);

  const topLossStreaks = useMemo(() => {
    return [...streaks]
      .filter(s => s.type === 'loss')
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [streaks]);

  // Calculate Y-axis domain
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [-1000, 1000];
    
    const isDollar = chartDisplayType === 'dollar';
    const allPositive = chartData.map(d => isDollar ? d.winAmount : d.winAmountPercent);
    const allNegative = chartData.map(d => isDollar ? d.lossAmount : d.lossAmountPercent);
    
    const maxVal = Math.max(...allPositive, 0);
    const minVal = Math.min(...allNegative, 0);
    
    const padding = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.1 || 100;
    return [minVal - padding, maxVal + padding];
  }, [chartData, chartDisplayType]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const data = payload[0].payload as ChartDataPoint;
    const streakLabel = label === 11 ? '> 10' : label;
    const isDollar = chartDisplayType === 'dollar';
    
    const winValue = isDollar ? data.winAmount : data.winAmountPercent;
    const lossValue = isDollar ? data.lossAmount : data.lossAmountPercent;
    
    const formatValue = (val: number) => {
      if (isPrivacyMode) return PRIVACY_MASK;
      if (isDollar) return formatCurrency(val);
      return `${val.toFixed(2)}%`;
    };

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-foreground font-semibold mb-2">
          {streakLabel} trades streak
        </p>
        {data.winFrequency > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-profit" />
              <span className="text-sm text-muted-foreground">Consecutive winners</span>
            </div>
            <p className="text-profit font-medium ml-4">{formatValue(winValue)}</p>
            <p className="text-xs text-muted-foreground ml-4">Frequency: {data.winFrequency}</p>
          </div>
        )}
        {data.lossFrequency > 0 && (
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-loss" />
              <span className="text-sm text-muted-foreground">Consecutive losers</span>
            </div>
            <p className="text-loss font-medium ml-4">{formatValue(lossValue)}</p>
            <p className="text-xs text-muted-foreground ml-4">Frequency: {data.lossFrequency}</p>
          </div>
        )}
      </div>
    );
  };

  if (!stats || filteredTrades.length === 0) {
    return (
      <div className="space-y-6">        <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground">No trades found for the selected filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-4"
        >
          <p className="text-xs text-muted-foreground mb-1">Longest Win Streak</p>
          <p className="text-2xl font-bold text-profit">{stats.longestWinStreak}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-4"
        >
          <p className="text-xs text-muted-foreground mb-1">Longest Loss Streak</p>
          <p className="text-2xl font-bold text-loss">{stats.longestLossStreak}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-4"
        >
          <p className="text-xs text-muted-foreground mb-1">Avg Win Streak</p>
          <p className="text-2xl font-bold text-foreground">{stats.avgWinStreak.toFixed(1)}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-4"
        >
          <p className="text-xs text-muted-foreground mb-1">Avg Loss Streak</p>
          <p className="text-2xl font-bold text-foreground">{stats.avgLossStreak.toFixed(1)}</p>
        </motion.div>
      </div>

      {/* Current Streak */}
      {stats.currentStreak && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
              <p className={cn(
                "text-3xl font-bold",
                stats.currentStreak.type === 'win' ? 'text-profit' : 'text-loss'
              )}>
                {stats.currentStreak.count} {stats.currentStreak.type === 'win' ? 'Wins' : 'Losses'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Streak P&L</p>
              <p className={cn(
                "text-xl font-semibold",
                isPrivacyMode ? 'text-foreground' : stats.currentStreak.totalPnl >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {maskCurrency(stats.currentStreak.totalPnl, formatCurrency)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Streak Distribution Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            {/* Header with Display Dropdown */}
            <div className="flex items-center justify-between mb-4">
              <Select 
                value={chartDisplayType} 
                onValueChange={(val) => setDisplayType(val as ChartDisplayType)}
              >
                <SelectTrigger className="w-[160px] bg-background border-border">
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">Average</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dollar">Return ($)</SelectItem>
                  <SelectItem value="percent">Return (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chart - 2x height (600px) */}
            <div className="h-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={chartData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  barGap={0}
                  barCategoryGap="20%"
                >
                  <Customized component={() => <ChartGradientDefs direction="vertical" idPrefix="consec" />} />
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="streak"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => value === 11 ? '> 10' : value}
                    label={{ 
                      value: 'Consecutive winners/losers', 
                      position: 'bottom', 
                      offset: 20,
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    domain={yAxisDomain}
                    tickFormatter={(value) => {
                      if (isPrivacyMode) return PRIVACY_MASK;
                      if (chartDisplayType === 'dollar') {
                        if (Math.abs(value) >= 1000) {
                          return `${(value / 1000).toFixed(1)}k`;
                        }
                        return value.toFixed(0);
                      }
                      return `${value.toFixed(1)}%`;
                    }}
                    label={{ 
                      value: chartDisplayType === 'dollar' ? 'Average Return ($)' : 'Average Return (%)', 
                      angle: -90, 
                      position: 'insideLeft',
                      offset: 0,
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                      style: { textAnchor: 'middle' },
                    }}
                  />
                  
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />

                  <Tooltip content={<CustomTooltip />} />

                  {/* Single range bar per streak value */}
                  <Bar 
                    dataKey={chartDisplayType === 'dollar' ? 'barRange' : 'barRangePercent'}
                    name="Streak"
                    maxBarSize={60}
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      if (!payload) return null;
                      
                      const isDollar = chartDisplayType === 'dollar';
                      const winValue = isDollar ? payload.winAmount : payload.winAmountPercent;
                      const lossValue = isDollar ? payload.lossAmount : payload.lossAmountPercent;
                      
                      // barRange = [lossValue (negative), winValue (positive)]
                      // y is the top of the bar, height is the full height from loss to win
                      const barTop = y;
                      const barBottom = y + height;
                      
                      // Calculate where 0 falls within this range
                      const totalRange = winValue - lossValue;
                      if (totalRange === 0) return null;
                      
                      const zeroRatio = winValue / totalRange;
                      const zeroY = barTop + (height * zeroRatio);
                      
                      return (
                        <g>
                          {/* Green portion: from zeroY to barTop (positive values) */}
                          {winValue > 0 && (
                            <rect
                              x={x}
                              y={barTop}
                              width={width}
                              height={Math.max(0, zeroY - barTop)}
                              fill={profitFill}
                              rx={4}
                              ry={4}
                            />
                          )}
                          {/* Red portion: from zeroY to barBottom (negative values) */}
                          {lossValue < 0 && (
                            <rect
                              x={x}
                              y={zeroY}
                              width={width}
                              height={Math.max(0, barBottom - zeroY)}
                              fill={lossFill}
                              rx={4}
                              ry={4}
                            />
                          )}
                        </g>
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Streaks Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Win Streaks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">Top Winning Streaks</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-muted-foreground">Rank</TableHead>
                  <TableHead className="text-muted-foreground">Wins</TableHead>
                  <TableHead className="text-muted-foreground">Total P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topWinStreaks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No winning streaks found
                    </TableCell>
                  </TableRow>
                ) : (
                  topWinStreaks.map((streak, idx) => (
                    <TableRow key={idx} className="border-border">
                      <TableCell className="text-foreground font-medium">#{idx + 1}</TableCell>
                      <TableCell className="text-profit font-semibold">{streak.count}</TableCell>
                      <TableCell className={cn(isPrivacyMode ? 'text-foreground' : 'text-profit')}>
                        {maskCurrency(streak.totalPnl, formatCurrency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>

        {/* Top Loss Streaks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">Top Losing Streaks</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-muted-foreground">Rank</TableHead>
                  <TableHead className="text-muted-foreground">Losses</TableHead>
                  <TableHead className="text-muted-foreground">Total P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLossStreaks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No losing streaks found
                    </TableCell>
                  </TableRow>
                ) : (
                  topLossStreaks.map((streak, idx) => (
                    <TableRow key={idx} className="border-border">
                      <TableCell className="text-foreground font-medium">#{idx + 1}</TableCell>
                      <TableCell className="text-loss font-semibold">{streak.count}</TableCell>
                      <TableCell className={cn(isPrivacyMode ? 'text-foreground' : 'text-loss')}>
                        {maskCurrency(streak.totalPnl, formatCurrency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ConsecutiveWinnersLosers;
