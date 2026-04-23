import { useMemo, useState } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { parseISO } from 'date-fns';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Scatter,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExitAnalysisData {
  trade: number;
  updraw: number;
  drawdown: number;
  exitPercent: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  // For range bar rendering: [bottom, top] of the bar
  barRange: [number, number];
}

const ExitAnalysis = () => {
  const { filteredTrades } = useFilteredTrades();
  const [displayType, setDisplayType] = useState('percentage');
  const [treatMissingAsZero, setTreatMissingAsZero] = useState(false);

  // Calculate exit analysis data for each trade
  const exitAnalysisData = useMemo(() => {
    // Sort trades by close date and filter closed trades with required data
    const sortedTrades = [...filteredTrades]
      .filter((trade: Trade) => {
        const metrics = calculateTradeMetrics(trade);
        if (
          metrics.positionStatus !== 'CLOSED' ||
          !metrics.closeDate ||
          trade.stopLoss === undefined ||
          trade.takeProfit === undefined ||
          metrics.avgEntryPrice <= 0 ||
          metrics.avgExitPrice <= 0
        ) {
          return false;
        }
        const hasMfe = trade.preMfePrice !== undefined && trade.preMfePrice !== null;
        const hasMae = trade.preMaePrice !== undefined && trade.preMaePrice !== null;
        // Both missing → always skip; both present → include;
        // one missing → include only when "Fill missing as 0" is on.
        if (!hasMfe && !hasMae) return false;
        if (hasMfe && hasMae) return true;
        return treatMissingAsZero;
      })
      .sort((a, b) => {
        const metricsA = calculateTradeMetrics(a);
        const metricsB = calculateTradeMetrics(b);
        return parseISO(metricsA.closeDate).getTime() - parseISO(metricsB.closeDate).getTime();
      });

    if (sortedTrades.length === 0) return [];

    return sortedTrades.map((trade, index) => {
      const metrics = calculateTradeMetrics(trade);
      const entryPrice = metrics.avgEntryPrice;
      const exitPrice = metrics.avgExitPrice;
      const stopLoss = trade.stopLoss!;
      const takeProfit = trade.takeProfit!;
      // Missing → no movement in that direction → use entry price (yields 0% updraw/drawdown).
      const farthestPriceInProfit =
        trade.preMfePrice !== undefined && trade.preMfePrice !== null
          ? trade.preMfePrice
          : entryPrice;
      const farthestPriceInLoss =
        trade.preMaePrice !== undefined && trade.preMaePrice !== null
          ? trade.preMaePrice
          : entryPrice;
      const side = trade.side;

      // Calculate Risk & Reward Ranges (Normalization)
      let rewardRange: number;
      let riskRange: number;

      if (side === 'LONG') {
        rewardRange = takeProfit - entryPrice;
        riskRange = entryPrice - stopLoss;
      } else {
        // SHORT
        rewardRange = entryPrice - takeProfit;
        riskRange = stopLoss - entryPrice;
      }

      // Avoid division by zero
      if (rewardRange <= 0) rewardRange = 0.0001;
      if (riskRange <= 0) riskRange = 0.0001;

      // Calculate Updraw (Favorable Move) - POSITIVE bar
      // Reflects the actual MFE relative to TP distance, may exceed 100% if price went past TP
      let updraw = 0;
      if (side === 'LONG') {
        updraw = ((farthestPriceInProfit - entryPrice) / rewardRange) * 100;
      } else {
        updraw = ((entryPrice - farthestPriceInProfit) / rewardRange) * 100;
      }
      updraw = Math.max(0, updraw); // Only floor at 0, no upper clamp

      // Calculate Drawdown (Adverse Move) - NEGATIVE bar
      // Reflects the actual MAE relative to SL distance, may exceed -100% if price went past SL
      let drawdown = 0;
      if (side === 'LONG') {
        drawdown = -((entryPrice - farthestPriceInLoss) / riskRange) * 100;
      } else {
        drawdown = -((farthestPriceInLoss - entryPrice) / riskRange) * 100;
      }
      drawdown = Math.min(0, drawdown); // Only ceil at 0, no lower clamp

      // Calculate Exit Percent
      let exitPercent: number;

      if (side === 'LONG') {
        // Check if exit at TP or SL
        if (exitPrice >= takeProfit) {
          exitPercent = 100;
        } else if (exitPrice <= stopLoss) {
          exitPercent = -100;
        } else if (exitPrice >= entryPrice) {
          // Profitable exit
          exitPercent = ((exitPrice - entryPrice) / rewardRange) * 100;
          exitPercent = Math.min(100, exitPercent);
        } else {
          // Losing exit
          exitPercent = -((entryPrice - exitPrice) / riskRange) * 100;
          exitPercent = Math.max(-100, exitPercent);
        }
      } else {
        // SHORT
        if (exitPrice <= takeProfit) {
          exitPercent = 100;
        } else if (exitPrice >= stopLoss) {
          exitPercent = -100;
        } else if (exitPrice <= entryPrice) {
          // Profitable exit
          exitPercent = ((entryPrice - exitPrice) / rewardRange) * 100;
          exitPercent = Math.min(100, exitPercent);
        } else {
          // Losing exit
          exitPercent = -((exitPrice - entryPrice) / riskRange) * 100;
          exitPercent = Math.max(-100, exitPercent);
        }
      }

      const roundedUpdraw = Math.round(updraw * 10) / 10;
      const roundedDrawdown = Math.round(drawdown * 10) / 10;
      
      return {
        trade: index + 1,
        updraw: roundedUpdraw,
        drawdown: roundedDrawdown,
        exitPercent: Math.round(exitPercent * 10) / 10,
        symbol: trade.symbol,
        side: trade.side,
        // barRange: [bottom (drawdown, negative), top (updraw, positive)]
        barRange: [roundedDrawdown, roundedUpdraw] as [number, number],
      };
    });
  }, [filteredTrades, treatMissingAsZero]);

  // Find Y-axis bounds
  const yAxisDomain = useMemo(() => {
    if (exitAnalysisData.length === 0) return [-120, 120];
    
    const maxUpdraw = Math.max(...exitAnalysisData.map(d => d.updraw), 100);
    const minDrawdown = Math.min(...exitAnalysisData.map(d => d.drawdown), -100);
    
    return [Math.min(minDrawdown - 10, -100), Math.max(maxUpdraw + 10, 100)];
  }, [exitAnalysisData]);

  // Diamond shape for exit marker
  const renderExitMarker = (props: any) => {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return null;
    
    const size = 6;
    return (
      <path
        d={`M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`}
        fill="#1a1a1a"
        stroke="#1a1a1a"
        strokeWidth={1}
      />
    );
  };

  // Calculate metrics from exitAnalysisData
  const calculatedMetrics = useMemo(() => {
    if (exitAnalysisData.length === 0) {
      return {
        tradesHitTP: 0,
        tradesHitSL: 0,
        avgUpdrawWinner: null,
        avgUpdrawLoser: null,
        avgDrawdownWinner: null,
        avgDrawdownLoser: null,
        avgExitWinner: null,
        avgExitLoser: null,
      };
    }

    // Trades that hit TP (+100%) or SL (-100%)
    const tradesHitTP = exitAnalysisData.filter(d => d.updraw >= 100).length;
    const tradesHitSL = exitAnalysisData.filter(d => d.drawdown <= -100).length;

    // Classify winners (exitPercent > 0) and losers (exitPercent < 0)
    const winners = exitAnalysisData.filter(d => d.exitPercent > 0);
    const losers = exitAnalysisData.filter(d => d.exitPercent < 0);

    // Average Updraw for Winners
    const avgUpdrawWinner = winners.length > 0
      ? winners.reduce((sum, d) => sum + d.updraw, 0) / winners.length
      : null;

    // Average Updraw for Losers
    const avgUpdrawLoser = losers.length > 0
      ? losers.reduce((sum, d) => sum + d.updraw, 0) / losers.length
      : null;

    // Average Drawdown for Winners (use absolute value)
    const avgDrawdownWinner = winners.length > 0
      ? winners.reduce((sum, d) => sum + Math.abs(d.drawdown), 0) / winners.length
      : null;

    // Average Drawdown for Losers (use absolute value)
    const avgDrawdownLoser = losers.length > 0
      ? losers.reduce((sum, d) => sum + Math.abs(d.drawdown), 0) / losers.length
      : null;

    // Average Exit for Winners
    const avgExitWinner = winners.length > 0
      ? winners.reduce((sum, d) => sum + d.exitPercent, 0) / winners.length
      : null;

    // Average Exit for Losers (use absolute value)
    const avgExitLoser = losers.length > 0
      ? losers.reduce((sum, d) => sum + Math.abs(d.exitPercent), 0) / losers.length
      : null;

    return {
      tradesHitTP,
      tradesHitSL,
      avgUpdrawWinner,
      avgUpdrawLoser,
      avgDrawdownWinner,
      avgDrawdownLoser,
      avgExitWinner,
      avgExitLoser,
    };
  }, [exitAnalysisData]);

  // Format metric value
  const formatMetric = (value: number | null, isCount = false): string => {
    if (value === null) return '—';
    if (isCount) return value.toString();
    return `${value.toFixed(1)}%`;
  };

  const metrics = [
    { label: 'Trades Hit TP', value: formatMetric(calculatedMetrics.tradesHitTP, true), hasInfo: true, color: 'green' },
    { label: 'Trades Hit SL', value: formatMetric(calculatedMetrics.tradesHitSL, true), hasInfo: true, color: 'red' },
    { label: 'Avg. Updraw Winner', value: formatMetric(calculatedMetrics.avgUpdrawWinner), hasInfo: false, color: 'green' },
    { label: 'Avg. Updraw Loser', value: formatMetric(calculatedMetrics.avgUpdrawLoser), hasInfo: false, color: 'green' },
    { label: 'Avg. Drawdown Winner', value: formatMetric(calculatedMetrics.avgDrawdownWinner), hasInfo: false, color: 'red' },
    { label: 'Avg. Drawdown Loser', value: formatMetric(calculatedMetrics.avgDrawdownLoser), hasInfo: false, color: 'red' },
    { label: 'Avg. Exit Winner', value: formatMetric(calculatedMetrics.avgExitWinner), hasInfo: false, color: 'green' },
    { label: 'Avg. Exit Loser', value: formatMetric(calculatedMetrics.avgExitLoser), hasInfo: false, color: 'red' },
  ];

  return (
    <div className="space-y-6">

      {/* Chart Container */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          {/* Header with Display Dropdown and Legend */}
          <div className="flex items-center justify-between mb-4">
            <Select value={displayType} onValueChange={setDisplayType}>
              <SelectTrigger className="w-[160px] bg-background border-border">
                <div className="flex flex-col items-start">
                  <span className="text-xs text-muted-foreground">Display</span>
                  <SelectValue placeholder="Percentage" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>

            {/* Fill missing as 0 toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={treatMissingAsZero}
                onChange={(e) => setTreatMissingAsZero(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-muted-foreground">Fill missing as 0</span>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[260px] text-xs">
                      If a trade has one value (e.g. Highest Price) but the other is empty (e.g. Lowest Price), the missing one is treated as no movement in that direction. Trades with both values missing are always excluded.
                    </p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </label>

            {/* Legend */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Updraw</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-muted-foreground">Drawdown</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[400px] w-full">
            {exitAnalysisData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={exitAnalysisData}
                  margin={{ top: 20, right: 30, left: 10, bottom: 30 }}
                  barGap={0}
                >
                  <XAxis
                    dataKey="trade"
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    label={{
                      value: 'Trades',
                      position: 'bottom',
                      offset: 10,
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    domain={yAxisDomain}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `${value}`}
                    ticks={[-100, -50, 0, 50, 100]}
                    label={{
                      value: 'Updraw / Drawdown',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                      style: { textAnchor: 'middle' },
                    }}
                  />
                  
                  {/* Reference Lines */}
                  <ReferenceLine y={100} stroke="hsl(142, 71%, 45%)" strokeWidth={1} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
                  <ReferenceLine y={-100} stroke="hsl(0, 84%, 60%)" strokeWidth={1} />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload as ExitAnalysisData;
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                          <p className="text-foreground font-medium mb-2">
                            Trade #{label} - {data.symbol} ({data.side})
                          </p>
                          <div className="space-y-1 text-sm">
                            <p className="text-green-500">Updraw: {data.updraw.toFixed(1)}%</p>
                            <p className="text-red-500">Drawdown: {data.drawdown.toFixed(1)}%</p>
                            <p className="text-foreground">Exit: {data.exitPercent.toFixed(1)}%</p>
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* Single range bar per trade using barRange [drawdown, updraw] */}
                  <Bar 
                    dataKey="barRange" 
                    name="excursion" 
                    maxBarSize={24}
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      if (!payload) return null;
                      
                      const updraw = payload.updraw;
                      const drawdown = payload.drawdown;
                      
                      // For range bars, y is the top of the bar, height is the full height
                      // We need to calculate where 0 falls within this range
                      const barTop = y; // This is the y position of the top (updraw)
                      const barBottom = y + height; // This is the y position of the bottom (drawdown)
                      
                      // Calculate the proportion where 0 falls
                      const totalRange = updraw - drawdown;
                      if (totalRange === 0) return null;
                      
                      const zeroRatio = updraw / totalRange;
                      const zeroY = barTop + (height * zeroRatio);
                      
                      return (
                        <g>
                          {/* Green portion: from zeroY to barTop (updraw > 0) */}
                          {updraw > 0 && (
                            <rect
                              x={x}
                              y={barTop}
                              width={width}
                              height={Math.max(0, zeroY - barTop)}
                              fill="hsl(142, 71%, 45%)"
                            />
                          )}
                          {/* Red portion: from zeroY to barBottom (drawdown < 0) */}
                          {drawdown < 0 && (
                            <rect
                              x={x}
                              y={zeroY}
                              width={width}
                              height={Math.max(0, barBottom - zeroY)}
                              fill="hsl(0, 84%, 60%)"
                            />
                          )}
                        </g>
                      );
                    }}
                  />

                  {/* Exit marker (black diamond) */}
                  <Scatter
                    dataKey="exitPercent"
                    name="exitPercent"
                    shape={renderExitMarker}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full border border-dashed border-border rounded-xl bg-muted/20">
                <p className="text-muted-foreground">No trades with complete exit analysis data.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Trades need: Stop Loss, Take Profit, Highest Price, and Lowest Price.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-1 mb-1">
                <div
                  className={`w-1 h-4 rounded-full ${
                    metric.color === 'green' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                {metric.hasInfo && (
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Metric explanation coming soon</p>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-xl font-semibold text-foreground">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ExitAnalysis;
