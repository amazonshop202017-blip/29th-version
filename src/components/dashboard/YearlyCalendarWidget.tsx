import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode, PRIVACY_MASK } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics } from '@/types/trade';
import { cn } from '@/lib/utils';

const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const currentYearConst = new Date().getFullYear();
const YEARS = Array.from({ length: 21 }, (_, i) => currentYearConst - 10 + i);

interface MonthStats {
  pnl: number;
  trades: number;
  rMultiple: number;
  hasData: boolean;
}

function YearDropdown({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm md:text-base font-semibold hover:bg-accent hover:text-accent-foreground rounded px-1.5 py-0.5 transition-colors border-b border-border"
      >
        {year}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 py-1 max-h-48 overflow-y-auto min-w-[80px]">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => { onChange(y); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                y === year && "bg-accent font-medium"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const YearlyCalendarWidget = () => {
  const { filteredTrades } = useFilteredTrades();
  const { formatCurrency } = useGlobalFilters();
  const { isPrivacyMode } = usePrivacyMode();
  const [year, setYear] = useState(new Date().getFullYear());
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  const monthStats = useMemo(() => {
    const map: MonthStats[] = Array.from({ length: 12 }, () => ({
      pnl: 0, trades: 0, rMultiple: 0, hasData: false,
    }));
    filteredTrades.forEach((trade) => {
      const m = calculateTradeMetrics(trade);
      if (!m.closeDate) return;
      const d = new Date(m.closeDate);
      if (d.getFullYear() !== year) return;
      const mi = d.getMonth();
      map[mi].pnl += m.netPnl;
      map[mi].trades += 1;
      map[mi].hasData = true;
      if (trade.savedRMultiple !== undefined && trade.savedRMultiple !== null && isFinite(trade.savedRMultiple)) {
        map[mi].rMultiple += trade.savedRMultiple;
      }
    });
    return map;
  }, [filteredTrades, year]);

  const yearTotals = useMemo(() => {
    return monthStats.reduce(
      (acc, m) => ({
        pnl: acc.pnl + m.pnl,
        trades: acc.trades + m.trades,
        rMultiple: acc.rMultiple + m.rMultiple,
      }),
      { pnl: 0, trades: 0, rMultiple: 0 }
    );
  }, [monthStats]);

  const fmtPnl = (v: number) => {
    if (isPrivacyMode) return PRIVACY_MASK;
    const sign = v >= 0 ? '+' : '-';
    return `${sign}${formatCurrency(Math.abs(v))}`;
  };

  const fmtR = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}R`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-xl p-3 md:p-6 h-full"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <YearDropdown year={year} onChange={setYear} />
          <button
            onClick={() => setYear((y) => y + 1)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">P&amp;L</span>
            <span
              className={cn(
                'font-mono font-semibold',
                isPrivacyMode
                  ? 'text-foreground'
                  : yearTotals.pnl >= 0
                    ? 'profit-text'
                    : 'loss-text'
              )}
            >
              {fmtPnl(yearTotals.pnl)}
            </span>
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Trades</span>
            <span className="font-mono font-semibold text-foreground">{yearTotals.trades}</span>
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">R</span>
            <span
              className={cn(
                'font-mono font-semibold',
                yearTotals.rMultiple >= 0 ? 'profit-text' : 'loss-text'
              )}
            >
              {fmtR(yearTotals.rMultiple)}
            </span>
          </span>
        </div>
      </div>

      {/* Months grid: 6 cols → 2 rows on sm+, 3 cols on mobile */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {MONTH_SHORT.map((name, idx) => {
          const s = monthStats[idx];
          const isCurrent = year === currentYear && idx === currentMonthIdx;
          return (
            <div
              key={name}
              className={cn(
                'rounded-lg border border-border/60 bg-card/40 p-3 transition-colors',
                isCurrent && 'ring-1 ring-primary/40 bg-accent/30'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium tracking-wider text-muted-foreground">
                  {name}
                </span>
                {isCurrent && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </div>

              {s.hasData ? (
                <p
                  className={cn(
                    'text-base md:text-lg font-bold font-mono leading-tight',
                    isPrivacyMode
                      ? 'text-foreground'
                      : s.pnl >= 0
                        ? 'profit-text'
                        : 'loss-text'
                  )}
                >
                  {fmtPnl(s.pnl)}
                </p>
              ) : (
                <p className="text-base md:text-lg font-bold text-muted-foreground/50 leading-tight">—</p>
              )}

              <div className="mt-1.5 text-[10px] md:text-xs">
                {s.hasData ? (
                  <span className="flex items-center gap-1 flex-wrap">
                    <span className="text-muted-foreground">
                      {s.trades} {s.trades === 1 ? 'trade' : 'trades'}
                    </span>
                    <span className="text-border">|</span>
                    <span className={cn('font-mono', s.rMultiple >= 0 ? 'profit-text' : 'loss-text')}>
                      {fmtR(s.rMultiple)}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">No trades</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
