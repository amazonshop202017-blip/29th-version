import { useMemo, useState } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics } from '@/types/trade';
import { motion } from 'framer-motion';
import { Info, Settings } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type TimeMode = 'entry' | 'exit';

interface ChartDataPoint {
  timeMinutes: number;
  timeDisplay: string;
  pnl: number;
  date: string;
  symbol: string;
  isProfit: boolean;
}

export const TradeTimePerformanceChart = () => {
  const { filteredTrades: trades } = useFilteredTrades();
  const { currencyConfig } = useGlobalFilters();
  const { isPrivacyMode } = usePrivacyMode();
  const [timeMode, setTimeMode] = useState<TimeMode>('entry');

  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];

    trades.forEach((trade) => {
      const metrics = calculateTradeMetrics(trade);
      
      // Separate entries based on trade side
      const buyEntries = trade.entries.filter(e => e.type === 'BUY');
      const sellEntries = trade.entries.filter(e => e.type === 'SELL');
      
      // For LONG trades: BUY is entry, SELL is exit
      // For SHORT trades: SELL is entry, BUY is exit
      const openingEntries = trade.side === 'LONG' ? buyEntries : sellEntries;
      const closingEntries = trade.side === 'LONG' ? sellEntries : buyEntries;
      
      // Sort entries by datetime
      const sortedOpeningEntries = [...openingEntries].sort(
        (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
      const sortedClosingEntries = [...closingEntries].sort(
        (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
      
      if (sortedOpeningEntries.length === 0) return;
      
      const entryDate = new Date(sortedOpeningEntries[0].datetime);
      if (isNaN(entryDate.getTime())) return;
      
      // Use exit time if available and mode is exit, otherwise use entry
      let timeDate = entryDate;
      if (timeMode === 'exit' && sortedClosingEntries.length > 0) {
        const exitDate = new Date(sortedClosingEntries[sortedClosingEntries.length - 1].datetime);
        if (!isNaN(exitDate.getTime())) {
          timeDate = exitDate;
        }
      }
      
      // Convert time to minutes from midnight for precise positioning
      const hours = timeDate.getHours();
      const minutes = timeDate.getMinutes();
      const timeMinutes = hours * 60 + minutes;
      
      data.push({
        timeMinutes,
        timeDisplay: format(timeDate, 'HH:mm'),
        pnl: metrics.netPnl,
        date: format(timeDate, 'MMM dd, yyyy'),
        symbol: trade.symbol,
        isProfit: metrics.netPnl >= 0,
      });
    });

    return data;
  }, [trades, timeMode]);

  const formatCurrency = (value: number) => {
    if (isPrivacyMode) return '**';
    const prefix = value >= 0 ? currencyConfig.symbol : `-${currencyConfig.symbol}`;
    return `${prefix}${Math.abs(value).toFixed(0)}`;
  };

  // Convert minutes back to time format for X-axis
  const formatTimeAxis = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    return `${hours}:00`;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      return (
        <div className="glass-card rounded-lg px-3 py-2 shadow-lg border border-border/50">
          <p className="text-xs text-muted-foreground">{data.date}</p>
          <p className="text-sm font-medium">{data.symbol}</p>
          <p className="text-xs text-muted-foreground">
            {timeMode === 'entry' ? 'Entry' : 'Exit'}: {data.timeDisplay}
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
        transition={{ duration: 0.4, delay: 0.5 }}
        className="glass-card rounded-xl p-6 h-full flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Trade Time Performance</h3>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Shows P&L by {timeMode === 'entry' ? 'entry' : 'exit'} time of day</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[120px]">
              <DropdownMenuItem 
                onClick={() => setTimeMode('entry')}
                className={timeMode === 'entry' ? 'bg-muted' : ''}
              >
                Entry time
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTimeMode('exit')}
                className={timeMode === 'exit' ? 'bg-muted' : ''}
              >
                Exit time
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      transition={{ duration: 0.4, delay: 0.5 }}
      className="glass-card rounded-xl p-6 h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Trade Time Performance</h3>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Shows P&L by {timeMode === 'entry' ? 'entry' : 'exit'} time of day</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            <DropdownMenuItem 
              onClick={() => setTimeMode('entry')}
              className={timeMode === 'entry' ? 'bg-muted' : ''}
            >
              Entry time
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setTimeMode('exit')}
              className={timeMode === 'exit' ? 'bg-muted' : ''}
            >
              Exit time
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              dataKey="timeMinutes"
              domain={[0, 1440]}
              tickFormatter={formatTimeAxis}
              ticks={[0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1440]}
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
