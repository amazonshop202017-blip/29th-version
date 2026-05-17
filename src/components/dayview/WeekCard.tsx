import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Trade, calculateTradeMetrics } from '@/types/trade';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { IntradayPnLChart } from './IntradayPnLChart';
import { DayTradesTable } from './DayTradesTable';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WeekCardProps {
  weekStart: Date;
  weekEnd: Date;
  trades: Trade[];
}

export const WeekCard = ({ weekStart, weekEnd, trades }: WeekCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { formatCurrency, classifyTradeOutcome } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency, maskProfitFactor } = usePrivacyMode();

  const weekStats = trades.reduce(
    (acc, trade) => {
      const metrics = calculateTradeMetrics(trade);
      const outcome = classifyTradeOutcome(metrics.netPnl, trade.savedReturnPercent, trade.breakEven);

      acc.netPnl += metrics.netPnl;
      acc.grossPnl += metrics.grossPnl;
      acc.totalTrades += 1;
      acc.totalQuantity += metrics.totalQuantity;
      acc.totalCommissions += metrics.totalCharges;

      if (outcome === 'win') {
        acc.winners += 1;
        acc.totalWins += metrics.netPnl;
      } else if (outcome === 'loss') {
        acc.losers += 1;
        acc.totalLosses += Math.abs(metrics.netPnl);
      } else {
        acc.breakeven += 1;
      }

      return acc;
    },
    {
      netPnl: 0,
      grossPnl: 0,
      totalTrades: 0,
      winners: 0,
      losers: 0,
      breakeven: 0,
      totalQuantity: 0,
      totalCommissions: 0,
      totalWins: 0,
      totalLosses: 0,
    }
  );

  const winsAndLosses = weekStats.winners + weekStats.losers;
  const winRate = winsAndLosses > 0 ? (weekStats.winners / winsAndLosses) * 100 : 0;
  const profitFactor = weekStats.totalLosses > 0
    ? weekStats.totalWins / weekStats.totalLosses
    : weekStats.totalWins > 0 ? Infinity : 0;

  const isProfit = weekStats.netPnl >= 0;
  const headerLabel = `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd, yyyy')}`;

  // Bucket trades into 7 days
  const dayBuckets = useMemo(() => {
    const buckets: { date: Date; trades: Trade[]; netPnl: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayTrades = trades.filter((t) => {
        const m = calculateTradeMetrics(t);
        if (!m.openDate) return false;
        return isSameDay(parseISO(m.openDate), day);
      });
      const netPnl = dayTrades.reduce((s, t) => s + calculateTradeMetrics(t).netPnl, 0);
      buckets.push({ date: day, trades: dayTrades, netPnl });
    }
    return buckets;
  }, [trades, weekStart]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-left">
          <span className="font-semibold text-sm sm:text-base text-foreground">{headerLabel}</span>
          <span className="hidden sm:inline text-muted-foreground">•</span>
          <span className={cn('font-semibold text-sm sm:text-base', isPrivacyMode ? 'text-foreground' : isProfit ? 'text-profit' : 'text-loss')}>
            Net P&L {maskCurrency(weekStats.netPnl, formatCurrency)}
          </span>
        </div>
      </button>

      <div className="px-3 sm:px-5 pb-4 sm:pb-5 space-y-4 sm:space-y-5">
        {/* 7-day pill row */}
        <div className="flex sm:grid sm:grid-cols-7 gap-2 overflow-x-auto -mx-1 px-1 snap-x">
          {dayBuckets.map((b) => {
            const hasTrades = b.trades.length > 0;
            const dayProfit = b.netPnl >= 0;
            return (
              <div
                key={b.date.toISOString()}
                className={cn(
                  'shrink-0 w-[88px] sm:w-auto sm:min-w-0 snap-start rounded-lg px-2 py-2 flex flex-col justify-between h-[78px]',
                  !hasTrades && 'bg-muted/40',
                  hasTrades && dayProfit && 'bg-profit/10 border border-profit/30',
                  hasTrades && !dayProfit && 'bg-loss/10 border border-loss/30'
                )}
              >
                <div className="text-xs text-muted-foreground text-right">
                  {format(b.date, 'EEE d')}
                </div>
                {hasTrades && (
                  <div className="flex flex-col items-end">
                    <span className={cn('text-sm font-semibold', isPrivacyMode ? 'text-foreground' : dayProfit ? 'text-profit' : 'text-loss')}>
                      {maskCurrency(b.netPnl, formatCurrency)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {b.trades.length} {b.trades.length === 1 ? 'trade' : 'trades'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Chart + Metrics */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-full md:w-[300px] h-[140px] flex-shrink-0">
            <IntradayPnLChart trades={trades} />
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Trades</p>
              <p className="text-base sm:text-lg font-semibold text-foreground">{weekStats.totalTrades}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Winners</p>
              <p className="text-base sm:text-lg font-semibold text-foreground">{weekStats.winners}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gross P&L</p>
              <p className={cn('text-base sm:text-lg font-semibold', isPrivacyMode ? 'text-foreground' : isProfit ? 'text-profit' : 'text-loss')}>
                {maskCurrency(weekStats.grossPnl, formatCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Commissions</p>
              <p className="text-base sm:text-lg font-semibold text-foreground">
                {maskCurrency(weekStats.totalCommissions, (v) => formatCurrency(v, false))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Winrate</p>
              <p className="text-base sm:text-lg font-semibold text-foreground">{winRate.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Losers</p>
              <p className="text-base sm:text-lg font-semibold text-foreground">{weekStats.losers}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Volume</p>
              <p className="text-base sm:text-lg font-semibold text-foreground">{weekStats.totalQuantity.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Profit Factor</p>
              <p className="text-base sm:text-lg font-semibold text-foreground">
                {maskProfitFactor(profitFactor)}
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-1 pt-5 border-t border-border">
                <DayTradesTable trades={trades} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};