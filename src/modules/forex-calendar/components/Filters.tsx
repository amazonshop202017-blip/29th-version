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
      "bg-white text-gray-600 border-gray-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700",
  },
  Medium: {
    active: "bg-orange-500 text-white border-orange-500 shadow-sm",
    inactive:
      "bg-white text-gray-600 border-gray-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700",
  },
  Low: {
    active: "bg-gray-500 text-white border-gray-500 shadow-sm",
    inactive:
      "bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-400",
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
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
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100 hover:border-gray-400"
                  )}
                >
                  {cur}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
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