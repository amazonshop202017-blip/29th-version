import { useMemo } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics } from '@/types/trade';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

interface ChartDataPoint {
  durationMinutes: number;
  durationDisplay: string;
  pnl: number;
  date: string;
  entryTime: string;
  exitTime: string;
  symbol: string;
  isProfit: boolean;
}

// Format duration for display
const formatDuration = (minutes: number): string => {
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds}s`;
  }
  if (minutes < 60) {
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    if (secs > 0) {
      return `${mins}m:${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins > 0) {
    return `${hours}h:${mins.toString().padStart(2, '0')}m`;
  }
  return `${hours}h`;
};

// Format duration for axis (shorter format)
const formatDurationAxis = (minutes: number): string => {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)}h`.replace('.0h', 'h');
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`.replace('.0d', 'd');
};

export const TradeDurationPerformanceChart = () => {
  const { filteredTrades: trades } = useFilteredTrades();
  const { currencyConfig } = useGlobalFilters();
  const { isPrivacyMode } = usePrivacyMode();

  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];

    trades.forEach((trade) => {
      const metrics = calculateTradeMetrics(trade);
      
      // Only include closed trades with valid duration
      if (metrics.positionStatus !== 'CLOSED' || metrics.durationMinutes <= 0) return;
      
      const sortedEntries = [...trade.entries].sort(
        (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
      
      if (sortedEntries.length < 2) return;
      
      const entryDate = new Date(sortedEntries[0].datetime);
      const exitDate = new Date(sortedEntries[sortedEntries.length - 1].datetime);
      
      if (isNaN(entryDate.getTime()) || isNaN(exitDate.getTime())) return;
      
      data.push({
        durationMinutes: metrics.durationMinutes,
        durationDisplay: formatDuration(metrics.durationMinutes),
        pnl: metrics.netPnl,
        date: format(entryDate, 'MMM dd, yyyy'),
        entryTime: format(entryDate, 'HH:mm'),
        exitTime: format(exitDate, 'HH:mm'),
        symbol: trade.symbol,
        isProfit: metrics.netPnl >= 0,
      });
    });

    // Sort by duration for better visualization
    return data.sort((a, b) => a.durationMinutes - b.durationMinutes);
  }, [trades]);

  const formatCurrency = (value: number) => {
    if (isPrivacyMode) return '**';
    const prefix = value >= 0 ? currencyConfig.symbol : `-${currencyConfig.symbol}`;
    return `${prefix}${Math.abs(value).toFixed(0)}`;
  };

  // Calculate logarithmic scale ticks based on data range
  const axisTicks = useMemo(() => {
    if (chartData.length === 0) return [1, 5, 15, 30, 60, 120, 240, 480];
    
    const maxDuration = Math.max(...chartData.map(d => d.durationMinutes));
    const ticks: number[] = [];
    
    // Generate ticks at meaningful intervals
    const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 720, 1440];
    intervals.forEach(interval => {
      if (interval <= maxDuration * 1.2) {
        ticks.push(interval);
      }
    });
    
    return ticks.slice(0, 8); // Limit to 8 ticks
  }, [chartData]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      return (
        <div className="glass-card rounded-lg px-3 py-2 shadow-lg border border-border/50">
          <p className="text-xs text-muted-foreground">{data.date}</p>
          <p className="text-sm font-medium">{data.symbol}</p>
          <p className="text-xs text-muted-foreground">
            Entry: {data.entryTime} → Exit: {data.exitTime}
          </p>
          <p className="text-xs text-muted-foreground">
            Duration: {data.durationDisplay}
          </p>
          <p className={`text-sm font-bold font-mono ${isPrivacyMode ? 'text-foreground' : data.isProfit ? 'profit-text' : 'loss-text'}`}>
            {isPrivacyMode ? '**' : `${data.pnl >= 0 ? '+' : ''}${formatCurrency(data.pnl)}`}
          </p>
        </div>
      );
    }
    return null;
  };

  if (trades.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="glass-card rounded-xl p-6 h-full flex flex-col"
      >
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold">Trade Duration Performance</h3>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Shows P&L by trade duration</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          No trades to display
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
      className="glass-card rounded-xl p-6 h-full flex flex-col"
    >
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">Trade Duration Performance</h3>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-4 w-4 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Shows P&L by trade duration</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              strokeOpacity={0.5}
            />
            <XAxis
              type="number"
              dataKey="durationMinutes"
              scale="log"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDurationAxis}
              ticks={axisTicks}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="number"
              dataKey="pnl"
              tickFormatter={formatCurrency}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <ReferenceLine 
              y={0} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3"
              strokeOpacity={0.7}
            />
            <Scatter 
              data={chartData} 
              fill="hsl(var(--chart-1))"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isProfit ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
