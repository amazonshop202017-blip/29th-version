import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Info, Newspaper } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useCalendarData } from '@/modules/forex-calendar/hooks/useCalendarData';
import type { CalendarEvent, CurrencyCode, ImpactLevel } from '@/modules/forex-calendar/types/calendar.types';
import { formatDateHeader, formatTime, getDateKey } from '@/modules/forex-calendar/utils/date.utils';
import { getCurrencyFlag } from '@/modules/forex-calendar/utils/format.utils';

const FILTER_KEY = 'forex-calendar-kpi-filters-v1';

const ALL_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF'];

interface KpiFilters {
  currencies: CurrencyCode[];
  impacts: ImpactLevel[];
}

const DEFAULT_FILTERS: KpiFilters = {
  currencies: ['USD'],
  impacts: ['High'],
};

function loadFilters(): KpiFilters {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      currencies: Array.isArray(parsed?.currencies) && parsed.currencies.length > 0
        ? parsed.currencies
        : DEFAULT_FILTERS.currencies,
      impacts: Array.isArray(parsed?.impacts) && parsed.impacts.length > 0
        ? parsed.impacts
        : DEFAULT_FILTERS.impacts,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(f: KpiFilters) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
}

const IMPACT_DOT: Record<ImpactLevel, string> = {
  High: 'bg-red-500',
  Medium: 'bg-orange-400',
  Low: 'bg-muted-foreground/60',
  Holiday: 'bg-blue-400',
  'Non-Economic': 'bg-muted-foreground/40',
};

const IMPACT_ORDER: ImpactLevel[] = ['High', 'Medium', 'Low'];

export const ForexNewsKpi = () => {
  const [filters, setFilters] = useState<KpiFilters>(() => loadFilters());
  const { events, isLoading, error } = useCalendarData();

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  const toggleImpact = (impact: ImpactLevel) => {
    setFilters((prev) => {
      const has = prev.impacts.includes(impact);
      const next = has ? prev.impacts.filter((i) => i !== impact) : [...prev.impacts, impact];
      return { ...prev, impacts: next.length === 0 ? [impact] : next };
    });
  };

  const toggleCurrency = (cur: CurrencyCode) => {
    setFilters((prev) => {
      const has = prev.currencies.includes(cur);
      const next = has ? prev.currencies.filter((c) => c !== cur) : [...prev.currencies, cur];
      return { ...prev, currencies: next.length === 0 ? [cur] : next };
    });
  };

  const grouped = useMemo(() => {
    const filtered = events.filter(
      (e) =>
        filters.currencies.includes(e.currency as CurrencyCode) &&
        filters.impacts.includes(e.impact),
    );
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const key = getDateKey(e.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, evts]) => ({
        key,
        label: formatDateHeader(evts[0].date),
        events: evts.sort((a, b) => a.date.getTime() - b.date.getTime()),
      }));
  }, [events, filters]);

  const currencyLabel =
    filters.currencies.length === 1
      ? filters.currencies[0]
      : `${filters.currencies.length} currencies`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
      className="glass-card rounded-xl p-6 h-full flex flex-col min-h-0"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Newspaper className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-lg font-semibold truncate">Forex News</h3>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Upcoming economic events filtered by currency & impact.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          {IMPACT_ORDER.map((imp) => {
            const active = filters.impacts.includes(imp);
            return (
              <Tooltip key={imp}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toggleImpact(imp)}
                    className={cn(
                      'h-5 w-5 rounded-full border transition-all flex items-center justify-center',
                      active
                        ? 'border-foreground/30 scale-100'
                        : 'border-transparent opacity-40 hover:opacity-70',
                    )}
                    aria-label={`Toggle ${imp} impact`}
                  >
                    <span className={cn('h-3 w-3 rounded-full', IMPACT_DOT[imp])} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{imp} impact</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <span className="truncate max-w-[110px]">{currencyLabel}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1">
            <div className="space-y-0.5">
              {ALL_CURRENCIES.map((cur) => {
                const active = filters.currencies.includes(cur);
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => toggleCurrency(cur)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base leading-none">{getCurrencyFlag(cur)}</span>
                      <span className="font-medium">{cur}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 text-foreground" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2">
        {isLoading && (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Loading economic events...
          </div>
        )}

        {error && !isLoading && (
          <div className="h-full flex items-center justify-center text-xs text-red-500 text-center px-4">
            {error}
          </div>
        )}

        {!isLoading && !error && grouped.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground text-center px-4">
            No events match your filters.
          </div>
        )}

        {!isLoading && !error && grouped.length > 0 && (
          <div className="space-y-3">
            {grouped.map((g) => (
              <div key={g.key}>
                <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm py-1 mb-1.5 border-b border-border">
                  <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {g.label}
                  </p>
                </div>
                <div className="space-y-1">
                  {g.events.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 py-1.5 px-1.5 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex items-center gap-1 w-[58px] shrink-0">
                        <span className="text-sm leading-none">{getCurrencyFlag(e.currency)}</span>
                        <span className="text-xs font-semibold text-foreground">{e.currency}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums w-[64px] shrink-0">
                        {formatTime(e.date)}
                      </span>
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full shrink-0',
                          IMPACT_DOT[e.impact],
                        )}
                        title={`${e.impact} impact`}
                      />
                      <span className="text-xs font-medium text-foreground truncate flex-1">
                        {e.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
