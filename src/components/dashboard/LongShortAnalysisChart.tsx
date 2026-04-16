import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Customized } from 'recharts';
import { motion } from 'framer-motion';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode, PRIVACY_MASK } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics } from '@/types/trade';
import { Info, Settings } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartGradientDefs, useGradientFill } from '@/components/charts/ChartGradientDefs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type DisplayMode = 'pnl' | 'winrate';

interface DirectionData {
  direction: string;
  pnl: number;
  tradeCount: number;
  winRate: number;
  winners: number;
  losers: number;
}

export const LongShortAnalysisChart = () => {
  const { filteredTrades: trades } = useFilteredTrades();
  const { currencyConfig } = useGlobalFilters();
  const { isPrivacyMode } = usePrivacyMode();
  const { getFill } = useGradientFill('longShort');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('pnl');

  const chartData = useMemo(() => {
    if (trades.length === 0) return [];

    let longPnl = 0, longCount = 0, longWins = 0, longLosses = 0;
    let shortPnl = 0, shortCount = 0, shortWins = 0, shortLosses = 0;

    trades.forEach(trade => {
      const metrics = calculateTradeMetrics(trade);
      const sortedEntries = [...trade.entries].sort((a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
      const firstEntry = sortedEntries[0];
      if (!firstEntry) return;

      const isLong = firstEntry.type === 'BUY';

      if (isLong) {
        longPnl += metrics.netPnl;
        longCount++;
        if (metrics.netPnl > 0) longWins++;
        else if (metrics.netPnl < 0) longLosses++;
      } else {
        shortPnl += metrics.netPnl;
        shortCount++;
        if (metrics.netPnl > 0) shortWins++;
        else if (metrics.netPnl < 0) shortLosses++;
      }
    });

    const data: DirectionData[] = [];

    if (longCount > 0) {
      data.push({
        direction: 'Long',
        pnl: longPnl,
        tradeCount: longCount,
        winRate: (longWins / longCount) * 100,
        winners: longWins,
        losers: longLosses,
      });
    }

    if (shortCount > 0) {
      data.push({
        direction: 'Short',
        pnl: shortPnl,
        tradeCount: shortCount,
        winRate: (shortWins / shortCount) * 100,
        winners: shortWins,
        losers: shortLosses,
      });
    }

    return data;
  }, [trades]);

  const formatCurrency = (value: number) => {
    if (isPrivacyMode) return PRIVACY_MASK;
    if (Math.abs(value) >= 1000) {
      return `${value >= 0 ? '' : '-'}${currencyConfig.symbol}${(Math.abs(value) / 1000).toFixed(1)}k`;
    }
    return `${value >= 0 ? '' : '-'}${currencyConfig.symbol}${Math.abs(value).toFixed(0)}`;
  };

  const formatPercent = (value: number) => {
    if (isPrivacyMode) return PRIVACY_MASK;
    return `${value.toFixed(1)}%`;
  };

  const dataKey = displayMode === 'pnl' ? 'pnl' : 'winRate';
  const tickFormatter = displayMode === 'pnl' ? formatCurrency : formatPercent;

  const headerContent = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Long/short analysis</h3>
        <UITooltip>
          <TooltipTrigger>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Shows {displayMode === 'pnl' ? 'net P&L' : 'win rate'} breakdown by trade direction</p>
          </TooltipContent>
        </UITooltip>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[120px]">
          <DropdownMenuItem
            onClick={() => setDisplayMode('pnl')}
            className={displayMode === 'pnl' ? 'bg-accent' : ''}
          >
            Net PnL
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDisplayMode('winrate')}
            className={displayMode === 'winrate' ? 'bg-accent' : ''}
          >
            Win Rate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card rounded-xl p-4 h-full flex flex-col min-h-[300px]"
      >
        {headerContent}
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Add trades to see direction analysis
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-xl p-4 h-full flex flex-col min-h-[300px]"
    >
      {headerContent}

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <Customized component={() => <ChartGradientDefs direction="vertical" idPrefix="longShort" />} />
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="direction"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              dy={5}
            />
            <YAxis
              tickFormatter={tickFormatter}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={50}
              domain={displayMode === 'winrate' ? [0, 100] : ['auto', 'auto']}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as DirectionData;
                  return (
                    <div className="glass-card rounded-lg px-3 py-2 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">{data.direction}</p>
                      {displayMode === 'pnl' ? (
                        <p className={`text-sm font-semibold font-mono ${isPrivacyMode ? 'text-foreground' : data.pnl >= 0 ? 'profit-text' : 'loss-text'}`}>
                          {isPrivacyMode ? PRIVACY_MASK : `${data.pnl >= 0 ? '+' : ''}${formatCurrency(data.pnl)}`}
                        </p>
                      ) : (
                        <p className="text-sm font-semibold font-mono text-foreground">
                          {isPrivacyMode ? PRIVACY_MASK : `${data.winRate.toFixed(1)}%`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.tradeCount} trade{data.tradeCount !== 1 ? 's' : ''}
                        {displayMode === 'winrate' && !isPrivacyMode && (
                          <span> ({data.winners}W / {data.losers}L)</span>
                        )}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            {displayMode === 'pnl' && (
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            )}
            <Bar
              dataKey={dataKey}
              radius={[4, 4, 4, 4]}
              maxBarSize={30}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    displayMode === 'pnl'
                      ? getFill(entry.pnl >= 0)
                      : 'hsl(var(--chart-1))'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
