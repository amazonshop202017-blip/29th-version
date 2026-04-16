import { useMemo } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics } from '@/types/trade';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart2, Clock, Percent } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Customized,
} from 'recharts';
import { ChartGradientDefs, useGradientFill, CustomColorGradientDefs, useCustomColorGradientFill } from '@/components/charts/ChartGradientDefs';

interface DurationBucket {
  label: string;
  minMinutes: number;
  maxMinutes: number;
}

// Duration buckets matching the reference design
const DURATION_BUCKETS: DurationBucket[] = [
  { label: '0s-15s', minMinutes: 0, maxMinutes: 0.25 },
  { label: '15s-45s', minMinutes: 0.25, maxMinutes: 0.75 },
  { label: '45s-1m', minMinutes: 0.75, maxMinutes: 1 },
  { label: '1m-2m', minMinutes: 1, maxMinutes: 2 },
  { label: '2m-5m', minMinutes: 2, maxMinutes: 5 },
  { label: '5m-10m', minMinutes: 5, maxMinutes: 10 },
  { label: '10m-30m', minMinutes: 10, maxMinutes: 30 },
  { label: '30m-1h', minMinutes: 30, maxMinutes: 60 },
  { label: '1h-2h', minMinutes: 60, maxMinutes: 120 },
  { label: '2h-4h', minMinutes: 120, maxMinutes: 240 },
  { label: '4h-24h', minMinutes: 240, maxMinutes: 1440 },
];

interface BucketData {
  bucket: string;
  totalPnl: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
}

// Hook to calculate bucket data
export const useTradeDurationBuckets = () => {
  const { filteredTrades } = useFilteredTrades();

  return useMemo(() => {
    const bucketMap = new Map<string, BucketData>();

    // Initialize all buckets
    DURATION_BUCKETS.forEach((bucket) => {
      bucketMap.set(bucket.label, {
        bucket: bucket.label,
        totalPnl: 0,
        tradeCount: 0,
        winCount: 0,
        lossCount: 0,
        winRate: 0,
      });
    });

    // Process trades
    filteredTrades.forEach((trade) => {
      const metrics = calculateTradeMetrics(trade);
      if (metrics.positionStatus !== 'CLOSED' || metrics.durationMinutes <= 0) return;

      // Find the matching bucket
      const bucket = DURATION_BUCKETS.find(
        (b) => metrics.durationMinutes >= b.minMinutes && metrics.durationMinutes < b.maxMinutes
      );

      if (bucket) {
        const data = bucketMap.get(bucket.label)!;
        data.totalPnl += metrics.netPnl;
        data.tradeCount += 1;
        if (metrics.netPnl > 0) {
          data.winCount += 1;
        } else if (metrics.netPnl < 0) {
          data.lossCount += 1;
        }
      }
    });

    // Calculate win rates - keep all buckets for consistent layout
    const result: BucketData[] = [];
    DURATION_BUCKETS.forEach((bucket) => {
      const data = bucketMap.get(bucket.label)!;
      if (data.tradeCount > 0) {
        data.winRate = (data.winCount / data.tradeCount) * 100;
      }
      result.push(data);
    });

    return result;
  }, [filteredTrades]);
};

// Performance by Trade Duration Chart - Horizontal bars
export const PerformanceByDurationChart = () => {
  const bucketData = useTradeDurationBuckets();
  const { currencyConfig } = useGlobalFilters();
  const { isPrivacyMode } = usePrivacyMode();
  const { profitFill, lossFill } = useGradientFill('perfDur');

  const formatCurrency = (value: number, signed = false) => {
    if (isPrivacyMode) return '**';
    if (value === 0) return '$0';
    if (signed) {
      const prefix = value >= 0 ? '+$' : '-$';
      return `${prefix}${Math.abs(value).toFixed(0)}`;
    }
    return `${currencyConfig.symbol}${Math.abs(value).toFixed(0)}`;
  };

  // Use absolute values for bar lengths, keep original sign for color
  const chartData = useMemo(() => {
    return bucketData.map(d => ({
      ...d,
      absPnl: Math.abs(d.totalPnl),
    }));
  }, [bucketData]);

  // Calculate domain for x-axis using absolute values
  const xDomain = useMemo(() => {
    const max = Math.max(...chartData.map(d => d.absPnl), 0);
    const padding = Math.max(max * 0.15, 50);
    return [0, max + padding];
  }, [chartData]);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-base font-semibold">Performance By Trade Duration</h3>
        </div>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 80, left: 10, bottom: 10 }}
            >
              <Customized component={() => <ChartGradientDefs direction="horizontal" idPrefix="perfDur" />} />
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.2}
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={xDomain}
                orientation="top"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={(value) => `${currencyConfig.symbol}${value}`}
              />
              <YAxis
                type="category"
                dataKey="bucket"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={70}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload as BucketData & { absPnl: number };
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="text-foreground font-medium mb-2">{data.bucket}</p>
                      <div className="space-y-1 text-sm">
                        <p className={isPrivacyMode ? 'text-foreground' : data.totalPnl >= 0 ? 'profit-text' : 'loss-text'}>
                          P&L: {isPrivacyMode ? '**' : formatCurrency(data.totalPnl, true)}
                        </p>
                        <p className="text-muted-foreground">
                          Trades: {data.tradeCount}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="absPnl"
                radius={[0, 4, 4, 0]}
                label={{
                  position: 'right',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 11,
                  formatter: (value: number, _: any, index: number) => {
                    const original = chartData[index];
                    if (!original || original.totalPnl === 0) return '';
                    return formatCurrency(original.totalPnl, true);
                  },
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.totalPnl >= 0 ? profitFill : lossFill}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Trade Count by Trade Duration Chart - Horizontal bars
export const TradeCountByDurationChart = () => {
  const bucketData = useTradeDurationBuckets();
  const { getCustomFill } = useCustomColorGradientFill('tcDur');
  const BLUE = 'hsl(217, 91%, 60%)';

  // Calculate max for domain
  const xMax = useMemo(() => {
    const max = Math.max(...bucketData.map(d => d.tradeCount), 1);
    return Math.ceil(max * 1.2);
  }, [bucketData]);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-base font-semibold">Trade Count By Trade Duration</h3>
        </div>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bucketData}
              layout="vertical"
              margin={{ top: 10, right: 50, left: 10, bottom: 10 }}
            >
              <Customized component={() => <CustomColorGradientDefs colors={[BLUE]} idPrefix="tcDur" />} />
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.2}
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, xMax]}
                orientation="top"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="bucket"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={70}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload as BucketData;
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="text-foreground font-medium mb-2">{data.bucket}</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          Total Trades: {data.tradeCount}
                        </p>
                        <p className="profit-text">Winners: {data.winCount}</p>
                        <p className="loss-text">Losers: {data.lossCount}</p>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="tradeCount"
                fill={getCustomFill(BLUE, 0)}
                radius={[0, 4, 4, 0]}
                label={{
                  position: 'right',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 11,
                  formatter: (value: number) => value > 0 ? value : '',
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Win Rate by Trade Duration Chart - Horizontal bars
export const WinRateByDurationChart = () => {
  const bucketData = useTradeDurationBuckets();
  const { getCustomFill } = useCustomColorGradientFill('wrDur');
  const BLUE = 'hsl(217, 91%, 60%)';

  // Calculate overall win rate
  const overallWinRate = useMemo(() => {
    const totalTrades = bucketData.reduce((sum, d) => sum + d.tradeCount, 0);
    const totalWins = bucketData.reduce((sum, d) => sum + d.winCount, 0);
    return totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
  }, [bucketData]);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Percent className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-base font-semibold">Win Rate By Trade Duration</h3>
        </div>
        <div className="h-[350px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bucketData}
              layout="vertical"
              margin={{ top: 10, right: 50, left: 10, bottom: 10 }}
            >
              <Customized component={() => <CustomColorGradientDefs colors={[BLUE]} idPrefix="wrDur" />} />
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.2}
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                orientation="top"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={(value) => `${value}%`}
                ticks={[0, 25, 50, 75, 100]}
              />
              <YAxis
                type="category"
                dataKey="bucket"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={70}
              />
              <ReferenceLine 
                x={overallWinRate} 
                stroke="hsl(45, 93%, 47%)" 
                strokeWidth={2}
                strokeDasharray="3 3"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload as BucketData;
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="text-foreground font-medium mb-2">{data.bucket}</p>
                      <div className="space-y-1 text-sm">
                        <p className={data.winRate >= 50 ? 'profit-text' : 'loss-text'}>
                          Win Rate: {data.winRate.toFixed(1)}%
                        </p>
                        <p className="text-muted-foreground">
                          {data.winCount}W / {data.lossCount}L ({data.tradeCount} trades)
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="winRate"
                fill={getCustomFill(BLUE, 0)}
                radius={[0, 4, 4, 0]}
                label={{
                  position: 'right',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 11,
                  formatter: (value: number) => value > 0 ? `${value.toFixed(0)}%` : '',
                }}
              />
            </BarChart>
          </ResponsiveContainer>
          
          {/* Overall Win Rate Badge */}
          <div className="absolute bottom-0 right-0 px-2 py-1 bg-amber-500/20 border border-amber-500/50 rounded text-xs text-amber-400 font-medium">
            {overallWinRate.toFixed(1)}% Overall
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
