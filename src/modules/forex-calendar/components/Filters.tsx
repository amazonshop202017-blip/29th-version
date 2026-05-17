import { cn } from "@/lib/utils";
import type { CurrencyCode, ImpactLevel } from "../types/calendar.types";

const CURRENCIES: CurrencyCode[] = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "NZD",
];

const IMPACTS: { level: ImpactLevel; label: string }[] = [
  { level: "High", label: "High" },
  { level: "Medium", label: "Medium" },
  { level: "Low", label: "Low" },
];

const IMPACT_COLORS: Record<
  string,
  { active: string; inactive: string }
> = {
  High: {
    active: "bg-red-600 text-white border-red-600 shadow-sm",
    inactive:
      "bg-card text-muted-foreground border-border hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-900/60 hover:text-red-700 dark:hover:text-red-300",
  },
  Medium: {
    active: "bg-orange-500 text-white border-orange-500 shadow-sm",
    inactive:
      "bg-card text-muted-foreground border-border hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:border-orange-300 dark:hover:border-orange-900/60 hover:text-orange-700 dark:hover:text-orange-300",
  },
  Low: {
    active: "bg-muted-foreground text-background border-muted-foreground shadow-sm",
    inactive:
      "bg-card text-muted-foreground border-border hover:bg-muted hover:border-border",
  },
};

interface FiltersProps {
  selectedCurrencies: CurrencyCode[];
  selectedImpacts: ImpactLevel[];
  onToggleCurrency: (currency: CurrencyCode) => void;
  onToggleImpact: (impact: ImpactLevel) => void;
}

export function Filters({
  selectedCurrencies,
  selectedImpacts,
  onToggleCurrency,
  onToggleImpact,
}: FiltersProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 mb-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Currency Focus
          </p>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((cur) => {
              const isActive = selectedCurrencies.includes(cur);
              return (
                <button
                  key={cur}
                  onClick={() => onToggleCurrency(cur)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:bg-muted hover:border-border"
                  )}
                >
                  {cur}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Impact Level
          </p>
          <div className="flex flex-wrap gap-2">
            {IMPACTS.map(({ level, label }) => {
              const isActive = selectedImpacts.includes(level);
              const colors = IMPACT_COLORS[level];
              return (
                <button
                  key={level}
                  onClick={() => onToggleImpact(level)}
                  className={cn(
                    "px-5 py-1.5 rounded-md text-xs font-semibold border transition-all duration-150 min-w-[80px] cursor-pointer",
                    isActive ? colors.active : colors.inactive
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
