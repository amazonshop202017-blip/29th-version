import { useMemo } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { motion } from 'framer-motion';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { calculateTradeMetrics } from '@/types/trade';
import { cn } from '@/lib/utils';

const LONG_COLOR = 'hsl(174, 32%, 50%)';
const SHORT_COLOR = 'hsl(290, 18%, 60%)';

interface SideStats {
  count: number;
  pnl: number;
  grossProfits: number;
  grossLosses: number; // positive number representing absolute losses
  rSum: number;
  rCount: number; // count of trades that contributed to R (with tradeRisk > 0)
  best: number;
  worst: number;
  wins: number;
  losses: number;
  hasTrades: boolean;
}

const emptySide = (): SideStats => ({
  count: 0,
  pnl: 0,
  grossProfits: 0,
  grossLosses: 0,
  rSum: 0,
  rCount: 0,
  best: -Infinity,
  worst: Infinity,
  wins: 0,
  losses: 0,
  hasTrades: false,
});

export const DirectionSplit = () => {
  const { filteredTrades: trades } = useFilteredTrades();
  const { formatCurrency } = useGlobalFilters();

  const { long, short, total } = useMemo(() => {
    const long = emptySide();
    const short = emptySide();

    trades.forEach(trade => {
      const metrics = calculateTradeMetrics(trade);
      const sortedEntries = [...trade.entries].sort(
        (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
      const firstEntry = sortedEntries[0];
      if (!firstEntry) return;
      const isLong = firstEntry.type === 'BUY';
      const side = isLong ? long : short;

      side.hasTrades = true;
      side.count += 1;
      side.pnl += metrics.netPnl;

      if (metrics.netPnl > 0) {
        side.grossProfits += metrics.netPnl;
        side.wins += 1;
      } else if (metrics.netPnl < 0) {
        side.grossLosses += Math.abs(metrics.netPnl);
        side.losses += 1;
      }

      if (metrics.netPnl > side.best) side.best = metrics.netPnl;
      if (metrics.netPnl < side.worst) side.worst = metrics.netPnl;

      if (trade.tradeRisk && trade.tradeRisk > 0) {
        side.rSum += metrics.rFactor;
        side.rCount += 1;
      }
    });

    return { long, short, total: long.count + short.count };
  }, [trades]);

  if (total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card rounded-xl p-4 h-full flex flex-col min-h-[300px]"
      >
        <div className="mb-2">
          <h3 className="text-sm font-medium text-foreground">Direction Split</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No trade data available
        </div>
      </motion.div>
    );
  }

  const longPct = (long.count / total) * 100;
  const shortPct = (short.count / total) * 100;

  // Derived metrics per side
  const computeMetrics = (s: SideStats) => {
    const profitFactor = s.grossLosses > 0 ? s.grossProfits / s.grossLosses : (s.grossProfits > 0 ? Infinity : 0);
    const avgR = s.rCount > 0 ? s.rSum / s.rCount : 0;
    const expectancy = s.count > 0 ? s.pnl / s.count : 0;
    const best = s.best === -Infinity ? 0 : s.best;
    const worst = s.worst === Infinity ? 0 : s.worst;
    return { profitFactor, avgR, expectancy, best, worst };
  };

  const longM = computeMetrics(long);
  const shortM = computeMetrics(short);

  const fmtPF = (v: number) => (v === Infinity ? '∞' : v.toFixed(2));
  const fmtR = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  const fmtMoney = (v: number) => formatCurrency(v, v !== 0);

  const pieData = [
    { id: 0, value: long.count, label: 'Long', color: LONG_COLOR },
    { id: 1, value: short.count, label: 'Short', color: SHORT_COLOR },
  ].filter(d => d.value > 0);

  const rows: { label: string; long: string; short: string; longPositive?: boolean; shortPositive?: boolean }[] = [
    {
      label: 'Profit Factor',
      long: fmtPF(longM.profitFactor),
      short: fmtPF(shortM.profitFactor),
      longPositive: longM.profitFactor >= 1,
      shortPositive: shortM.profitFactor >= 1,
    },
    {
      label: 'Avg R',
      long: fmtR(longM.avgR),
      short: fmtR(shortM.avgR),
      longPositive: longM.avgR >= 0,
      shortPositive: shortM.avgR >= 0,
    },
    {
      label: 'Expectancy',
      long: fmtMoney(longM.expectancy),
      short: fmtMoney(shortM.expectancy),
      longPositive: longM.expectancy >= 0,
      shortPositive: shortM.expectancy >= 0,
    },
    {
      label: 'Best Trade',
      long: fmtMoney(longM.best),
      short: fmtMoney(shortM.best),
      longPositive: longM.best >= 0,
      shortPositive: shortM.best >= 0,
    },
    {
      label: 'Worst Trade',
      long: fmtMoney(longM.worst),
      short: fmtMoney(shortM.worst),
      longPositive: longM.worst >= 0,
      shortPositive: shortM.worst >= 0,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-xl p-4 h-full flex flex-col min-h-[300px]"
    >
      <div className="mb-1">
        <h3 className="text-sm font-medium text-foreground">Direction Split</h3>
      </div>

      <div className="flex-1 flex flex-col md:flex-row items-center gap-4 min-h-0">
        {/* Left: Donut */}
        <div className="relative flex items-center justify-center shrink-0" style={{ width: 160, height: 160 }}>
          <PieChart
            series={[
              {
                data: pieData,
                innerRadius: 42,
                outerRadius: 72,
                paddingAngle: 2,
                cornerRadius: 3,
                cx: 75,
                cy: 75,
                arcLabel: () => '',
                highlightScope: { fade: 'global', highlight: 'item' },
              },
            ]}
            width={160}
            height={160}
            hideLegend
            skipAnimation={false}
          />
        </div>

        {/* Right: Header bar + stats table */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-2">
          {/* Long/Short header with proportional bar */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LONG_COLOR }} />
              <span className="text-muted-foreground">Long {longPct.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Short {shortPct.toFixed(0)}%</span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SHORT_COLOR }} />
            </div>
          </div>
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted/40">
            <motion.div
              className="h-full"
              style={{ backgroundColor: LONG_COLOR }}
              initial={{ width: 0 }}
              animate={{ width: `${longPct}%` }}
              transition={{ duration: 0.6 }}
            />
            <motion.div
              className="h-full"
              style={{ backgroundColor: SHORT_COLOR }}
              initial={{ width: 0 }}
              animate={{ width: `${shortPct}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>

          {/* Stats rows */}
          <div className="mt-1 divide-y divide-border/40">
            {rows.map(row => (
              <div key={row.label} className="grid grid-cols-3 items-center py-1.5 text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <span
                  className={cn(
                    'text-right font-mono font-medium',
                    long.hasTrades
                      ? row.longPositive
                        ? 'text-[hsl(var(--profit))]'
                        : 'text-[hsl(var(--loss))]'
                      : 'text-muted-foreground'
                  )}
                >
                  {long.hasTrades ? row.long : '—'}
                </span>
                <span
                  className={cn(
                    'text-right font-mono font-medium',
                    short.hasTrades
                      ? row.shortPositive
                        ? 'text-[hsl(var(--profit))]'
                        : 'text-[hsl(var(--loss))]'
                      : 'text-muted-foreground'
                  )}
                >
                  {short.hasTrades ? row.short : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
