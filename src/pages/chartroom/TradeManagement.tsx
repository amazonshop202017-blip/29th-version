import { useMemo } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartDataPoint {
  tradeIndex: number;
  tradeId: string;
  actualR: number;
  setForgetR: number;
  potentialR: number | null;
  cumulativeActual: number;
  cumulativeSetForget: number;
  cumulativePotential: number | null;
}

const TradeManagement = () => {
  const { filteredTrades } = useFilteredTrades();

  const chartData = useMemo(() => {
    // Filter eligible trades: must have entry price, stop loss, take profit, direction, and priceReachedFirst
    const eligibleTrades = filteredTrades.filter(trade => {
      const metrics = calculateTradeMetrics(trade);
      
      // Must be closed trade
      if (metrics.positionStatus !== 'CLOSED') return false;
      
      // Must have avg entry price
      if (!metrics.avgEntryPrice || metrics.avgEntryPrice <= 0) return false;
      
      // Must have stop loss
      if (!trade.stopLoss || trade.stopLoss <= 0) return false;
      
      // Must have take profit
      if (!trade.takeProfit || trade.takeProfit <= 0) return false;
      
      // Must have direction (side)
      if (!trade.side) return false;
      
      // Must have priceReachedFirst
      if (!trade.priceReachedFirst) return false;
      
      // Must have savedRMultiple for actual performance
      if (trade.savedRMultiple === undefined) return false;
      
      return true;
    });

    // Sort by entry date (openDate)
    const sortedTrades = [...eligibleTrades].sort((a, b) => {
      const metricsA = calculateTradeMetrics(a);
      const metricsB = calculateTradeMetrics(b);
      return new Date(metricsA.openDate).getTime() - new Date(metricsB.openDate).getTime();
    });

    // Build chart data
    let cumulativeActual = 0;
    let cumulativeSetForget = 0;
    let cumulativePotential = 0;
    let hasPotentialData = false;
    
    const data: ChartDataPoint[] = sortedTrades.map((trade, index) => {
      const metrics = calculateTradeMetrics(trade);
      const entry = metrics.avgEntryPrice;
      const tp = trade.takeProfit!;
      const sl = trade.stopLoss!;
      
      // Actual R: Use the stored savedRMultiple
      const actualR = trade.savedRMultiple ?? 0;
      
      // Set & Forget R: TP/SL only logic (renamed from "Potential")
      let setForgetR = 0;
      
      if (trade.priceReachedFirst === 'takeProfit') {
        // Calculate planned RR
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
      
      // Potential R: Maximum favorable excursion (MFE in R)
      // Uses farthestPriceInProfit for BOTH long and short trades
      let potentialR: number | null = null;
      
      if (trade.priceReachedFirst === 'stopLoss') {
        // If SL was hit first, potential is -1R
        potentialR = -1;
      } else {
        // Calculate based on preMfePrice (direction-aware)
        if (trade.preMfePrice !== undefined && trade.preMfePrice !== null && trade.preMfePrice > 0) {
          if (trade.side === 'LONG') {
            const risk = entry - sl;
            if (risk > 0) {
              potentialR = Math.max(-1, (trade.preMfePrice - entry) / risk);
            }
          } else {
            // SHORT: profit = entry - preMfePrice
            const risk = sl - entry;
            if (risk > 0) {
              potentialR = Math.max(-1, (entry - trade.preMfePrice) / risk);
            }
          }
        }
      }
      
      // Track if we have any potential data
      if (potentialR !== null) {
        hasPotentialData = true;
        cumulativePotential += potentialR;
      }
      
      cumulativeActual += actualR;
      cumulativeSetForget += setForgetR;
      
      return {
        tradeIndex: index + 1,
        tradeId: trade.id,
        actualR: parseFloat(actualR.toFixed(2)),
        setForgetR: parseFloat(setForgetR.toFixed(2)),
        potentialR: potentialR !== null ? parseFloat(potentialR.toFixed(2)) : null,
        cumulativeActual: parseFloat(cumulativeActual.toFixed(2)),
        cumulativeSetForget: parseFloat(cumulativeSetForget.toFixed(2)),
        cumulativePotential: potentialR !== null ? parseFloat(cumulativePotential.toFixed(2)) : null,
      };
    });
    
    return { data, hasPotentialData };
  }, [filteredTrades]);

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

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Performance Comparison (R-Multiple)</CardTitle>
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
                  <p className="text-sm text-muted-foreground">Total Potential (MFE)</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default TradeManagement;
