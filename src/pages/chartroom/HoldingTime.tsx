import { useMemo, useState } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode, PRIVACY_MASK } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { mapGlobalToChartDisplay } from '@/hooks/useChartDisplayMode';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  PerformanceByDurationChart,
  TradeCountByDurationChart,
  WinRateByDurationChart,
} from '@/components/chartroom/TradeDurationBucketCharts';
import { PerformanceByDurationCompareChart } from '@/components/chartroom/PerformanceByDurationCompareChart';

type TimeUnit = 'days' | 'hours' | 'minutes';
// Privacy removed from dropdown - handled via global filter
type DisplayType = 'dollar' | 'percent' | 'tickpip';

interface HoldingTimeData {
  holdingTime: number;
  returnValue: number;
  isWinner: boolean;
  symbol: string;
  side: 'LONG' | 'SHORT';
  netPnl: number;
  returnPercent: number;
}

const HoldingTime = () => {
  const { filteredTrades } = useFilteredTrades();
  const { displayMode } = useGlobalFilters();
  const { isPrivacyMode } = usePrivacyMode();
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('hours');
  
  // Map global display mode to holding time display type
  const getInitialDisplayType = (): DisplayType => {
    const mapped = mapGlobalToChartDisplay(displayMode);
    if (mapped === 'dollar') return 'dollar';
    if (mapped === 'percent') return 'percent';
    if (mapped === 'tickpip') return 'tickpip';
    // Privacy mode falls back to 'dollar' (handled by mapGlobalToChartDisplay)
    return 'dollar';
  };
  
  const [displayType, setDisplayType] = useState<DisplayType>(getInitialDisplayType);

  // Helper to convert minutes to selected time unit
  const convertTime = (minutes: number, unit: TimeUnit): number => {
    switch (unit) {
      case 'days':
        return minutes / (60 * 24);
      case 'hours':
        return minutes / 60;
      case 'minutes':
        return minutes;
      default:
        return minutes;
    }
  };

  // NOTE: Return (%) is now stored on each trade as savedReturnPercent
  // We use the stored value directly - never recalculate it

  // Calculate holding time data for each closed trade
  const holdingTimeData = useMemo(() => {
    const closedTrades = filteredTrades.filter((trade: Trade) => {
      const metrics = calculateTradeMetrics(trade);
      return metrics.positionStatus === 'CLOSED' && metrics.closeDate && metrics.durationMinutes > 0;
    });

    return closedTrades
      .filter((trade) => {
        // For percent mode, skip trades without stored return %
        if (displayType === 'percent') {
          const returnPercent = trade.savedReturnPercent;
          if (returnPercent === undefined || returnPercent === null || !isFinite(returnPercent)) {
            return false;
          }
        }
        return true;
      })
      .map((trade) => {
        const metrics = calculateTradeMetrics(trade);
        const holdingTimeInUnit = convertTime(metrics.durationMinutes, timeUnit);
        // Use stored Return % from trade
        const returnPercent = trade.savedReturnPercent ?? 0;

        return {
          holdingTime: Math.round(holdingTimeInUnit * 100) / 100,
          returnValue: displayType === 'dollar' ? metrics.netPnl : returnPercent,
          isWinner: metrics.netPnl > 0,
          symbol: trade.symbol,
          side: trade.side,
          netPnl: metrics.netPnl,
          returnPercent,
        };
      });
  }, [filteredTrades, timeUnit, displayType]);

  // Split data for coloring
  const winnerData = holdingTimeData.filter(d => d.isWinner);
  const loserData = holdingTimeData.filter(d => !d.isWinner);

  // Calculate metrics
  const metrics = useMemo(() => {
    const winners = holdingTimeData.filter(d => d.isWinner);
    const losers = holdingTimeData.filter(d => !d.isWinner);

    const winnerHoldingTimes = winners.map(d => d.holdingTime);
    const loserHoldingTimes = losers.map(d => d.holdingTime);

    const winnerAvg = winnerHoldingTimes.length > 0
      ? winnerHoldingTimes.reduce((a, b) => a + b, 0) / winnerHoldingTimes.length
      : 0;
    const loserAvg = loserHoldingTimes.length > 0
      ? loserHoldingTimes.reduce((a, b) => a + b, 0) / loserHoldingTimes.length
      : 0;

    const winnerSum = winnerHoldingTimes.reduce((a, b) => a + b, 0);
    const loserSum = loserHoldingTimes.reduce((a, b) => a + b, 0);

    const biggestWinner = winnerHoldingTimes.length > 0
      ? Math.max(...winnerHoldingTimes)
      : 0;
    const biggestLoser = loserHoldingTimes.length > 0
      ? Math.max(...loserHoldingTimes)
      : 0;

    return {
      winnerAvg,
      loserAvg,
      winnerSum,
      loserSum,
      biggestWinner,
      biggestLoser,
    };
  }, [holdingTimeData]);

  // Format time value with unit
  const formatTimeValue = (value: number): string => {
    const rounded = Math.round(value * 100) / 100;
    const unitLabel = timeUnit === 'days' ? 'd' : timeUnit === 'hours' ? 'h' : 'm';
    return `${rounded.toFixed(2)} ${unitLabel}`;
  };

  // Get unit label for axis
  const getTimeUnitLabel = (): string => {
    switch (timeUnit) {
      case 'days':
        return 'Days';
      case 'hours':
        return 'Hours';
      case 'minutes':
        return 'Minutes';
      default:
        return 'Time';
    }
  };

  // Y-axis domain
  const yAxisDomain = useMemo(() => {
    if (holdingTimeData.length === 0) return [-100, 100];
    const values = holdingTimeData.map(d => d.returnValue);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const padding = Math.max(Math.abs(max - min) * 0.1, 10);
    return [min - padding, max + padding];
  }, [holdingTimeData]);

  // X-axis domain
  const xAxisDomain = useMemo(() => {
    if (holdingTimeData.length === 0) return [0, 10];
    const values = holdingTimeData.map(d => d.holdingTime);
    const max = Math.max(...values);
    return [0, max * 1.1];
  }, [holdingTimeData]);

  const metricsCards = [
    { label: 'Winner Holding Time Avg', value: formatTimeValue(metrics.winnerAvg), color: 'green' },
    { label: 'Loser Holding Time Avg', value: formatTimeValue(metrics.loserAvg), color: 'red' },
    { label: 'Winner Holding Time Sum', value: formatTimeValue(metrics.winnerSum), color: 'green' },
    { label: 'Loser Holding Time Sum', value: formatTimeValue(metrics.loserSum), color: 'red' },
    { label: 'Biggest Winner (Holding Time)', value: formatTimeValue(metrics.biggestWinner), color: 'green' },
    { label: 'Biggest Loser (Holding Time)', value: formatTimeValue(metrics.biggestLoser), color: 'red' },
  ];

  return (
    <div className="space-y-6">

      {/* Chart Container */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          {/* Header with Dropdowns and Legend */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Select value={displayType} onValueChange={(v) => setDisplayType(v as DisplayType)}>
                <SelectTrigger className="w-[160px] bg-background border-border">
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">Display</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  <SelectItem value="dollar">Return ($)</SelectItem>
                  <SelectItem value="percent">Return (%)</SelectItem>
                  <SelectItem value="tickpip">Tick / Pip</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeUnit} onValueChange={(v) => setTimeUnit(v as TimeUnit)}>
                <SelectTrigger className="w-[160px] bg-background border-border">
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">Time Settings</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--profit))' }} />
                <span className="text-sm text-muted-foreground">Winner</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--loss))' }} />
                <span className="text-sm text-muted-foreground">Loser</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[400px] w-full">
            {holdingTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 30 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="hsl(var(--border))" 
                    opacity={0.3}
                  />
                  <XAxis
                    type="number"
                    dataKey="holdingTime"
                    domain={xAxisDomain}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    label={{
                      value: `Holding Time (${getTimeUnitLabel()})`,
                      position: 'bottom',
                      offset: 10,
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="returnValue"
                    domain={yAxisDomain}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (isPrivacyMode) return PRIVACY_MASK;
                      if (displayType === 'tickpip') return `${value.toFixed(0)} T`;
                      if (displayType === 'percent') return `${value.toFixed(1)}%`;
                      return `$${value.toFixed(0)}`;
                    }}
                    label={{
                      value: displayType === 'tickpip' ? 'Return (Tick/Pip)'
                        : displayType === 'percent' ? 'Return (%)' 
                        : 'Return ($)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                      style: { textAnchor: 'middle' },
                    }}
                  />
                  
                  {/* Reference Line at 0 */}
                  <ReferenceLine 
                    y={0} 
                    stroke="hsl(var(--border))" 
                    strokeWidth={2}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload as HoldingTimeData;
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                          <p className="text-foreground font-medium mb-2">
                            {data.symbol} ({data.side})
                          </p>
                          <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">
                              Holding Time: {formatTimeValue(data.holdingTime)}
                            </p>
                            {displayType === 'dollar' && (
                              <p className={data.isWinner ? 'profit-text' : 'loss-text'}>
                                Net P/L: {isPrivacyMode ? PRIVACY_MASK : `$${data.netPnl.toFixed(2)}`}
                              </p>
                            )}
                            {displayType === 'percent' && (
                              <p className={data.isWinner ? 'profit-text' : 'loss-text'}>
                                Return: {isPrivacyMode ? PRIVACY_MASK : `${data.returnPercent.toFixed(2)}%`}
                              </p>
                            )}
                            {displayType === 'tickpip' && (
                              <p className={data.isWinner ? 'profit-text' : 'loss-text'}>
                                Tick/Pip: {isPrivacyMode ? PRIVACY_MASK : '--'}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* Winner dots (green) */}
                  <Scatter
                    name="Winners"
                    data={winnerData}
                    fill="hsl(var(--profit))"
                  />

                  {/* Loser dots (red) */}
                  <Scatter
                    name="Losers"
                    data={loserData}
                    fill="hsl(var(--loss))"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full border border-dashed border-border rounded-xl bg-muted/20">
                <p className="text-muted-foreground">No closed trades with holding time data available.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricsCards.map((metric) => (
          <Card key={metric.label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
              <p className={`text-lg font-semibold ${
                metric.color === 'green' ? 'profit-text' : 'loss-text'
              }`}>
                {metric.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New: Two-column comparison charts (mirrors Performance by Time) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerformanceByDurationCompareChart useGlobalDefault={true} />
        <PerformanceByDurationCompareChart defaultDisplayType="winrate" useGlobalDefault={false} />
      </div>

      {/* Trade Duration Charts Section */}
      <PerformanceByDurationChart />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TradeCountByDurationChart />
        <WinRateByDurationChart />
      </div>
    </div>
  );
};

export default HoldingTime;
