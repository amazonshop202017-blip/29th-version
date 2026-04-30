import { cn } from "@/lib/utils";
import { formatTabLabel } from "../utils/date.utils";

interface DateTabsProps {
  dates: string[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function DateTabs({
  dates,
  selectedDate,
  onSelectDate,
}: DateTabsProps) {
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex flex-wrap items-center gap-1.5 pb-2">
        {dates.map((dateKey) => {
          const date = new Date(dateKey + "T00:00:00");
          const label = formatTabLabel(date);
          const isActive = selectedDate === dateKey;

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(isActive ? null : dateKey)}
              className={cn(
                "px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-150 border cursor-pointer",
                isActive
                  ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}