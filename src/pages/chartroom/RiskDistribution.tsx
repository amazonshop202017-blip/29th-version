import { useMemo, useState, useEffect } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { calculateTradeMetrics } from '@/types/trade';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
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

type DisplayType = 'rMultiple' | 'returnPercent';

interface BucketData {
  label: string;
  sortOrder: number;
  rangeStart: number;
  rangeEnd: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  isWinningBucket: boolean;
}

const RiskDistribution = () => {
  const { filteredTrades } = useFilteredTrades();
  const { currencyConfig } = useGlobalFilters();
  const { getFill } = useGradientFill('riskDist');
  
  const [displayType, setDisplayType] = useState<DisplayType>('returnPercent');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Labels to show on X-axis for Return (%) mode - every 0.5% interval
  const returnPercentLabelsToShow = new Set([
    '< -10',
    '-9.75 to -9.50', '-9.25 to -9.00', '-8.75 to -8.50', '-8.25 to -8.00',
    '-7.75 to -7.50', '-7.25 to -7.00', '-6.75 to -6.50', '-6.25 to -6.00',
    '-5.75 to -5.50', '-5.25 to -5.00', '-4.75 to -4.50', '-4.25 to -4.00',
    '-3.75 to -3.50', '-3.25 to -3.00', '-2.75 to -2.50', '-2.25 to -2.00',
    '-1.75 to -1.50', '-1.25 to -1.00', '-0.75 to -0.50', '-0.25 to 0.00',
    '0.25 to 0.50', '0.75 to 1.00', '1.25 to 1.50', '1.75 to 2.00',
    '2.25 to 2.50', '2.75 to 3.00', '3.25 to 3.50', '3.75 to 4.00',
    '4.25 to 4.50', '4.75 to 5.00', '5.25 to 5.50', '5.75 to 6.00',
    '6.25 to 6.50', '6.75 to 7.00', '7.25 to 7.50', '7.75 to 8.00',
    '8.25 to 8.50', '8.75 to 9.00', '9.25 to 9.50', '9.75 to 10.00',
    '> 10'
  ]);

  // Get closed trades only
  const closedTrades = useMemo(() => {
    return filteredTrades.filter(trade => {
      const metrics = calculateTradeMetrics(trade);
      return metrics.positionStatus === 'CLOSED';
    });
  }, [filteredTrades]);

  // Get trade values from SAVED trade data (NOT recalculated)
  // - R-Multiple: use trade.savedRMultiple (stored value from trade popup)
  // - Return (%): use trade.savedReturnPercent (stored value based on account balance at trade time)
  const tradeValues = useMemo(() => {
    return closedTrades
      .map(trade => {
        const metrics = calculateTradeMetrics(trade);
        
        // Use SAVED values - never recalculate here
        let value: number | undefined;
        if (displayType === 'rMultiple') {
          value = trade.savedRMultiple;
        } else {
          value = trade.savedReturnPercent;
        }
        
        // Exclude trades where the required value is missing
        if (value === undefined || value === null || !isFinite(value)) {
          return null;
        }
        
        const isWin = metrics.netPnl > 0;
        const isLoss = metrics.netPnl < 0;
        const isBreakeven = metrics.netPnl === 0;
        return { value, isWin, isLoss, isBreakeven };
      })
      .filter((item): item is { value: number; isWin: boolean; isLoss: boolean; isBreakeven: boolean } => item !== null);
  }, [closedTrades, displayType]);

  // Generate buckets based on display type
  const bucketData = useMemo(() => {
    const bucketSize = displayType === 'rMultiple' ? 0.5 : 0.25;
    const maxBucket = displayType === 'rMultiple' ? 10 : 10;
    const minBucket = displayType === 'rMultiple' ? -5 : -10;
    
    // Initialize buckets array with all possible ranges
    const buckets: BucketData[] = [];
    
    // Add underflow bucket
    const minOverflowLabel = displayType === 'rMultiple' ? `< -5` : `< -10`;
    buckets.push({
      label: minOverflowLabel,
      sortOrder: minBucket - 1,
      rangeStart: -Infinity,
      rangeEnd: minBucket,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      isWinningBucket: false,
    });
    
    // Generate all possible buckets from min to max
    for (let start = minBucket; start < maxBucket; start = Math.round((start + bucketSize) * 100) / 100) {
      const end = Math.round((start + bucketSize) * 100) / 100;
      
      // Format label like the reference images
      let label: string;
      if (displayType === 'rMultiple') {
        // Format: "-4.5 to -4", "-0.5 to 0", "0 to 0.5", etc.
        const startStr = start % 1 === 0 ? start.toString() : start.toFixed(1);
        const endStr = end % 1 === 0 ? end.toString() : end.toFixed(1);
        label = `${startStr} to ${endStr}`;
      } else {
        // Format: "-0.25 to 0", "0 to 0.25", etc.
        const startStr = start.toFixed(2);
        const endStr = end.toFixed(2);
        label = `${startStr} to ${endStr}`;
      }
      
      buckets.push({
        label,
        sortOrder: start,
        rangeStart: start,
        rangeEnd: end,
        tradeCount: 0,
        winCount: 0,
        lossCount: 0,
        breakevenCount: 0,
        isWinningBucket: start >= 0,
      });
    }
    
    // Add overflow bucket
    const maxOverflowLabel = displayType === 'rMultiple' ? `> 10` : `> 10`;
    buckets.push({
      label: maxOverflowLabel,
      sortOrder: maxBucket + 1,
      rangeStart: maxBucket,
      rangeEnd: Infinity,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      isWinningBucket: true,
    });
    
    // Create a map for quick lookup using rangeStart as key
    const bucketsMap = new Map<number, BucketData>();
    buckets.forEach(b => bucketsMap.set(b.sortOrder, b));
    
    // Place trades into buckets using EXACT bucket calculation
    tradeValues.forEach(({ value, isWin, isLoss, isBreakeven }) => {
      // R-Multiple bucketing: bucketStart = Math.floor(value / 0.5) * 0.5
      // Return % bucketing: bucketStart = Math.floor(value / 0.25) * 0.25
      const bucketStart = Math.floor(value / bucketSize) * bucketSize;
      // Round to avoid floating point issues
      const bucketKey = Math.round(bucketStart * 100) / 100;
      
      // Handle overflow buckets
      let targetBucket: BucketData | undefined;
      if (value < minBucket) {
        targetBucket = bucketsMap.get(minBucket - 1);
      } else if (value >= maxBucket) {
        targetBucket = bucketsMap.get(maxBucket + 1);
      } else {
        targetBucket = bucketsMap.get(bucketKey);
      }
      
      if (targetBucket) {
        targetBucket.tradeCount++;
        if (isWin) targetBucket.winCount++;
        if (isLoss) targetBucket.lossCount++;
        if (isBreakeven) targetBucket.breakevenCount++;
      } else {
        // Debug: log if bucket not found (should not happen)
        console.warn(`R-Multiple bucket not found for value ${value}, bucketKey ${bucketKey}`);
      }
    });
    
    // Return ALL buckets sorted (including those with 0 trades)
    return buckets.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [tradeValues, displayType]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (tradeValues.length === 0) {
      return {
        avgValue: 0,
        totalValue: 0,
        avgWinnerValue: 0,
        avgLoserValue: 0,
        avgRRR: 0,
      };
    }

    const allValues = tradeValues.map(t => t.value);
    const winnerValues = tradeValues.filter(t => t.isWin).map(t => t.value);
    const loserValues = tradeValues.filter(t => t.isLoss).map(t => t.value);

    const avgValue = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const totalValue = allValues.reduce((a, b) => a + b, 0);
    const avgWinnerValue = winnerValues.length > 0 
      ? winnerValues.reduce((a, b) => a + b, 0) / winnerValues.length 
      : 0;
    const avgLoserValue = loserValues.length > 0 
      ? Math.abs(loserValues.reduce((a, b) => a + b, 0) / loserValues.length)
      : 0;

    // Calculate Avg RRR from trade data (tradeTarget / tradeRisk)
    const tradesWithRRR = closedTrades.filter(t => t.tradeRisk > 0 && t.tradeTarget > 0);
    const avgRRR = tradesWithRRR.length > 0
      ? tradesWithRRR.reduce((sum, t) => sum + (t.tradeTarget / t.tradeRisk), 0) / tradesWithRRR.length
      : 0;

    return {
      avgValue,
      totalValue,
      avgWinnerValue,
      avgLoserValue,
      avgRRR,
    };
  }, [tradeValues, closedTrades]);

  // Format value based on display type
  const formatValue = (value: number, showSign: boolean = false): string => {
    if (displayType === 'rMultiple') {
      const sign = showSign && value > 0 ? '+' : '';
      return `${sign}${value.toFixed(2)}R`;
    }
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Custom tooltip - only show for buckets with trades
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    const data = payload[0].payload as BucketData;
    
    // Don't show tooltip for empty buckets
    if (data.tradeCount === 0) return null;
    
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{data.label}</p>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Number of trades: <span className="text-foreground font-medium">{data.tradeCount}</span>
          </p>
          <p className="profit-text">
            Winners: <span className="font-medium">{data.winCount}</span>
          </p>
          <p className="loss-text">
            Losers: <span className="font-medium">{data.lossCount}</span>
          </p>
          <p className="text-muted-foreground">
            Break evens: <span className="text-foreground font-medium">{data.breakevenCount}</span>
          </p>
        </div>
      </div>
    );
  };

  // Custom X-axis tick for Return (%) - only show specific labels
  const renderCustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const label = payload.value;
    
    // For R Multiple mode, show all labels
    if (displayType === 'rMultiple') {
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={16}
            textAnchor="end"
            fill="hsl(var(--muted-foreground))"
            fontSize={10}
            transform="rotate(-45)"
          >
            {label}
          </text>
        </g>
      );
    }
    
    // For Return (%) mode, only show specific labels
    if (!returnPercentLabelsToShow.has(label)) {
      return null;
    }
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="end"
          fill="hsl(var(--muted-foreground))"
          fontSize={10}
          transform="rotate(-45)"
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6">

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Display</label>
          <Select value={displayType} onValueChange={(val) => setDisplayType(val as DisplayType)}>
            <SelectTrigger className="w-[160px] bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="returnPercent">Return (%)</SelectItem>
              <SelectItem value="rMultiple">R Multiple</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6 px-2 sm:px-6">
          {closedTrades.length > 0 ? (
            <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
              <BarChart 
                data={isMobile ? bucketData.filter(b => b.tradeCount > 0) : bucketData} 
                margin={isMobile ? { top: 10, right: 5, left: 0, bottom: 40 } : { top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <Customized component={() => <ChartGradientDefs direction="vertical" idPrefix="riskDist" />} />
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis 
                  dataKey="label" 
                  tick={renderCustomXAxisTick}
                  height={isMobile ? 60 : 80}
                  interval={0}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 10 : 12 }}
                  label={isMobile ? undefined : { 
                    value: 'Number of Trades', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fill: 'hsl(var(--muted-foreground))' }
                  }}
                  allowDecimals={false}
                  width={isMobile ? 30 : undefined}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
                <Bar dataKey="tradeCount" radius={[4, 4, 0, 0]}>
                  {(isMobile ? bucketData.filter(b => b.tradeCount > 0) : bucketData).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={getFill(entry.isWinningBucket)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] lg:h-[400px] text-muted-foreground">
              No closed trades to display
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {displayType === 'rMultiple' ? 'Avg R Multiple' : 'Avg Return (%)'}
            </p>
            <p className={`text-xl font-bold ${metrics.avgValue >= 0 ? 'profit-text' : 'loss-text'}`}>
              {formatValue(metrics.avgValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {displayType === 'rMultiple' ? 'Total R Multiple' : 'Total Return (%)'}
            </p>
            <p className={`text-xl font-bold ${metrics.totalValue >= 0 ? 'profit-text' : 'loss-text'}`}>
              {formatValue(metrics.totalValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {displayType === 'rMultiple' ? 'Avg R Multiple Winner' : 'Avg Return (%) Winner'}
            </p>
            <p className="text-xl font-bold profit-text">
              {formatValue(metrics.avgWinnerValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {displayType === 'rMultiple' ? 'Avg R Multiple Loser' : 'Avg Return (%) Loser'}
            </p>
            <p className="text-xl font-bold loss-text">
              {formatValue(-metrics.avgLoserValue)}
            </p>
          </CardContent>
        </Card>

        {displayType === 'rMultiple' && (
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">Avg RRR</p>
              <p className="text-xl font-bold text-foreground">
                {metrics.avgRRR.toFixed(2)}R
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default RiskDistribution;
