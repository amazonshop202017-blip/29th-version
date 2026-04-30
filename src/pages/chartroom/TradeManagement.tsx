import { useMemo, useState } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip as UITooltip,
  TooltipContent as UITooltipContent,
  TooltipProvider,
  TooltipTrigger as UITooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

type AnalysisMode = 'execution' | 'opportunity';

interface ChartDataPoint {
  tradeIndex: number;
  tradeId: string;
  symbol: string;
  actualR: number;
  setForgetR: number;
  potentialR: number | null;
  cumulativeActual: number;
  cumulativeSetForget: number;
  cumulativePotential: number | null;
}

/**
 * Single source of truth for both the chart and the capture-rate card.
 * Mode-specific branching lives ONLY here.
 */
function prepareTradeManagementData(
  trades: Trade[],
  mode: AnalysisMode,
): { data: ChartDataPoint[]; hasPotentialData: boolean } {
  // Shared eligibility — identical across modes.
  const eligibleTrades = trades.filter(trade => {
      const metrics = calculateTradeMetrics(trade);
      if (metrics.positionStatus !== 'CLOSED') return false;
      if (!metrics.avgEntryPrice || metrics.avgEntryPrice <= 0) return false;
      if (!trade.stopLoss || trade.stopLoss <= 0) return false;
      if (!trade.takeProfit || trade.takeProfit <= 0) return false;
      if (!trade.side) return false;
      if (!trade.priceReachedFirst) return false;
      if (trade.savedRMultiple === undefined && (metrics.rFactor === undefined || isNaN(metrics.rFactor))) return false;
      return true;
    });

    const sortedTrades = [...eligibleTrades].sort((a, b) => {
      const metricsA = calculateTradeMetrics(a);
      const metricsB = calculateTradeMetrics(b);
      return new Date(metricsA.openDate).getTime() - new Date(metricsB.openDate).getTime();
    });

    let cumulativeActual = 0;
    let cumulativeSetForget = 0;
    let cumulativePotential = 0;
    let hasPotentialData = false;
    
    const data: ChartDataPoint[] = sortedTrades.map((trade, index) => {
      const metrics = calculateTradeMetrics(trade);
      const entry = metrics.avgEntryPrice;
      const tp = trade.takeProfit!;
      const sl = trade.stopLoss!;
      
    // actualR is identical across modes — never branches on mode.
      const actualR = trade.savedRMultiple ?? metrics.rFactor ?? 0;
      
      let setForgetR = 0;
      if (trade.priceReachedFirst === 'takeProfit') {
        if (trade.side === 'LONG') {
          const risk = entry - sl;
          const reward = tp - entry;
          setForgetR = risk > 0 ? reward / risk : 0;
        } else {
          const risk = sl - entry;
          const reward = entry - tp;
          setForgetR = risk > 0 ? reward / risk : 0;
        }
      } else if (trade.priceReachedFirst === 'stopLoss') {
        setForgetR = -1;
      }

    // potentialR — the only field that depends on AnalysisMode.
      let potentialR: number | null = null;

    if (mode === 'execution') {
      if (trade.priceReachedFirst === 'stopLoss') {
        potentialR = -1;
      } else if (trade.preMfePrice !== undefined && trade.preMfePrice !== null && trade.preMfePrice > 0) {
          if (trade.side === 'LONG') {
            const risk = entry - sl;
            if (risk > 0) {
              potentialR = Math.max(-1, (trade.preMfePrice - entry) / risk);
            }
          } else {
            const risk = sl - entry;
            if (risk > 0) {
              potentialR = Math.max(-1, (entry - trade.preMfePrice) / risk);
            }
          }
        }
    } else {
      // Opportunity mode — post-exit only. No fallback, no clamp.
      if (trade.side === 'LONG') {
        const risk = entry - sl;
        if (
          risk > 0 &&
          trade.postMaxPrice !== undefined &&
          trade.postMaxPrice !== null &&
          trade.postMaxPrice > 0
        ) {
          potentialR = (trade.postMaxPrice - entry) / risk;
        }
      } else {
        const risk = sl - entry;
        if (
          risk > 0 &&
          trade.postMinPrice !== undefined &&
          trade.postMinPrice !== null &&
          trade.postMinPrice > 0
        ) {
          potentialR = (entry - trade.postMinPrice) / risk;
      }
      }
    }
      
      if (potentialR !== null) {
        hasPotentialData = true;
        cumulativePotential += potentialR;
      }
      
      cumulativeActual += actualR;
      cumulativeSetForget += setForgetR;
      
      return {
        tradeIndex: index + 1,
        tradeId: trade.id,
        symbol: trade.symbol ?? '',
        actualR: parseFloat(actualR.toFixed(2)),
        setForgetR: parseFloat(setForgetR.toFixed(2)),
        potentialR: potentialR !== null ? parseFloat(potentialR.toFixed(2)) : null,
        cumulativeActual: parseFloat(cumulativeActual.toFixed(2)),
        cumulativeSetForget: parseFloat(cumulativeSetForget.toFixed(2)),
        cumulativePotential: potentialR !== null ? parseFloat(cumulativePotential.toFixed(2)) : null,
      };
    });
    
    return { data, hasPotentialData };
}

const TradeManagement = () => {
  const { filteredTrades } = useFilteredTrades();
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('execution');

  const chartData = useMemo(
    () => prepareTradeManagementData(filteredTrades, analysisMode),
    [filteredTrades, analysisMode],
  );

  const modeCaption =
    analysisMode === 'execution'
      ? 'Based on price movement before exit (MFE)'
      : 'Based on full price movement after exit';

  const potentialKpiLabel =
    analysisMode === 'execution' ? 'Total Potential (MFE)' : 'Total Potential (Post-Exit)';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      
      // Format value safely, hiding if NaN or undefined
      const formatValue = (value: number | null | undefined): string | null => {
        if (value === null || value === undefined || isNaN(value)) return null;
        return value.toFixed(2);
      };
      
      const actualValue = formatValue(data.cumulativeActual);
      const setForgetValue = formatValue(data.cumulativeSetForget);
      const potentialValue = formatValue(data.cumulativePotential);
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-3">Trade #{data.tradeIndex}</p>
          <div className="space-y-2 text-sm">
            {actualValue !== null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Actual Performance:</span>
                <span className={parseFloat(actualValue) >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                  {actualValue} R
                </span>
              </div>
            )}
            {setForgetValue !== null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Set & Forget Performance:</span>
                <span className={parseFloat(setForgetValue) >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                  {setForgetValue} R
                </span>
              </div>
            )}
            {potentialValue !== null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Potential Performance:</span>
                <span className={parseFloat(potentialValue) >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                  {potentialValue} R
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const { data: chartDataArray, hasPotentialData } = chartData;

  // Build capture-rate rows from the SAME pipeline (no new formulas).
  // Eligibility: must have MFE-based potentialR (preMfePrice gate already applied upstream).
  const captureData = useMemo(() => {
    const eligible = chartDataArray
      .filter((d) => d.potentialR !== null)
      .map((d) => {
        const realizedR = d.actualR;
        const maxR = d.potentialR as number;
        const captureRate =
          maxR <= 0 ? 0 : Math.max(0, Math.min(1, realizedR / maxR));
        return {
          tradeIndex: d.tradeIndex,
          tradeId: d.tradeId,
          symbol: d.symbol,
          realizedR,
          maxR,
          captureRate,
        };
      });

    if (eligible.length === 0) {
      return {
        rows: [],
        avgRealized: 0,
        avgMax: 0,
        avgCapture: 0,
        globalMaxR: 1,
      };
    }

    const avgRealized =
      eligible.reduce((s, r) => s + r.realizedR, 0) / eligible.length;
    const avgMax = eligible.reduce((s, r) => s + r.maxR, 0) / eligible.length;
    const avgCapture =
      eligible.reduce((s, r) => s + r.captureRate, 0) / eligible.length;

    // Show last 12 (within the 10–15 range) in ASC order.
    const rows = eligible.slice(-12);
    const globalMaxR = Math.max(1, ...rows.map((r) => Math.max(r.maxR, 0)));

    return { rows, avgRealized, avgMax, avgCapture, globalMaxR };
  }, [chartDataArray]);

  const formatR = (v: number) => {
    const sign = v > 0 ? '+' : v < 0 ? '' : '+';
    // Show whole number for integer-like values (e.g. -1R, +0R), else 2 decimals
    const abs = Math.abs(v);
    const text = Number.isInteger(v) || abs < 0.005 ? `${Math.trunc(v)}` : v.toFixed(2);
    return `${sign}${text}R`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Analysis Mode</span>
        <ToggleGroup
          type="single"
          value={analysisMode}
          onValueChange={(v) => {
            if (v === 'execution' || v === 'opportunity') setAnalysisMode(v);
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="execution">Execution</ToggleGroupItem>
          <ToggleGroupItem value="opportunity">Opportunity</ToggleGroupItem>
        </ToggleGroup>
        <TooltipProvider>
          <UITooltip>
            <UITooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Analysis Mode info"
              >
                <Info className="h-4 w-4" />
              </button>
            </UITooltipTrigger>
            <UITooltipContent>
              Execution = before exit (MFE/MAE) · Opportunity = after exit (post max/min)
            </UITooltipContent>
          </UITooltip>
        </TooltipProvider>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Comparison (R-Multiple)</CardTitle>
          <p className="text-xs text-muted-foreground">
            {modeCaption}. This analysis is based on price ranges and does not consider order of movement.
          </p>
        </CardHeader>
        <CardContent>
          {chartDataArray.length === 0 ? (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">No eligible trades found</p>
                <p className="text-sm">
                  Trades must have: Entry Price, Stop Loss, Take Profit, Direction, 
                  saved R-Multiple, and "Which level did the price reach first?" set.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartDataArray} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="tradeIndex" 
                    stroke="hsl(var(--muted-foreground))"
                    label={{ value: 'Trades', position: 'bottom', offset: 0, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    label={{ value: 'R-Multiple', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativeActual" 
                    name="Actual Performance"
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-1))', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: 'hsl(var(--chart-1))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativeSetForget" 
                    name="Set & Forget Performance"
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: 'hsl(var(--chart-2))' }}
                  />
                  {hasPotentialData && (
                    <Line 
                      type="monotone" 
                      dataKey="cumulativePotential" 
                      name="Potential Performance"
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      dot={{ fill: 'hsl(var(--chart-3))', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, fill: 'hsl(var(--chart-3))' }}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {chartDataArray.length > 0 && (
        <div className={`grid grid-cols-1 ${hasPotentialData ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{chartDataArray.length}</p>
                <p className="text-sm text-muted-foreground">Eligible Trades</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${chartDataArray[chartDataArray.length - 1]?.cumulativeActual >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {chartDataArray[chartDataArray.length - 1]?.cumulativeActual.toFixed(2) ?? '0.00'}R
                </p>
                <p className="text-sm text-muted-foreground">Total Actual Performance</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${chartDataArray[chartDataArray.length - 1]?.cumulativeSetForget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {chartDataArray[chartDataArray.length - 1]?.cumulativeSetForget.toFixed(2) ?? '0.00'}R
                </p>
                <p className="text-sm text-muted-foreground">Total Set & Forget</p>
              </div>
            </CardContent>
          </Card>
          {hasPotentialData && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className={`text-2xl font-bold ${(chartDataArray[chartDataArray.length - 1]?.cumulativePotential ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {chartDataArray[chartDataArray.length - 1]?.cumulativePotential?.toFixed(2) ?? '0.00'}R
                  </p>
                  <p className="text-sm text-muted-foreground">{potentialKpiLabel}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {captureData.rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Realized RR vs Max Available RR</CardTitle>
            <p className="text-xs text-muted-foreground">
              Trade-level capture efficiency · {modeCaption}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {captureData.rows.map((row, idx) => {
                const maxPct = (row.maxR > 0 ? row.maxR / captureData.globalMaxR : 0) * 100;
                const filledPct =
                  row.realizedR > 0 && row.maxR > 0
                    ? (Math.min(row.realizedR, row.maxR) / captureData.globalMaxR) * 100
                    : 0;
                const stripedPct = Math.max(0, maxPct - filledPct);
                const capturePctText = `${(row.captureRate * 100).toFixed(1)}%`;

                return (
                  <div
                    key={row.tradeId}
                    className="flex items-center gap-3 group"
                    title={`${row.symbol}\nRealized: ${formatR(row.realizedR)}\nMax: ${formatR(row.maxR)}\nCapture: ${capturePctText}`}
                  >
                    <span className="w-5 text-xs text-muted-foreground tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="w-20 text-xs text-muted-foreground truncate">
                      {row.symbol || '—'}
                    </span>
                    <div className="relative flex-1 h-6 rounded bg-muted/60 overflow-hidden">
                      {filledPct > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 bg-green-500"
                          style={{ width: `${filledPct}%` }}
                        />
                      )}
                      {stripedPct > 0 && (
                        <div
                          className="absolute inset-y-0"
                          style={{
                            left: `${filledPct}%`,
                            width: `${stripedPct}%`,
                            backgroundImage:
                              'repeating-linear-gradient(45deg, hsl(var(--muted-foreground) / 0.35) 0 4px, transparent 4px 8px)',
                          }}
                        />
                      )}
                    </div>
                    <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                      {formatR(row.realizedR)}
                    </span>
                    <span
                      className={`w-14 text-right text-xs font-medium tabular-nums ${
                        row.captureRate > 0 ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {capturePctText}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Avg Realized
                </p>
                <p
                  className={`text-lg font-semibold ${
                    captureData.avgRealized > 0
                      ? 'text-green-600'
                      : captureData.avgRealized < 0
                      ? 'text-red-500'
                      : 'text-foreground'
                  }`}
                >
                  {captureData.avgRealized.toFixed(2)}R
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Avg Max
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {captureData.avgMax.toFixed(2)}R
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Capture
                </p>
                <p
                  className={`text-lg font-semibold ${
                    captureData.avgCapture > 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {Math.round(captureData.avgCapture * 100)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TradeManagement;
