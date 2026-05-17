import { cn } from "@/lib/utils";
import type { CalendarEvent } from "../types/calendar.types";
import { formatTime } from "../utils/date.utils";
import { safeValue, getCurrencyFlag } from "../utils/format.utils";

interface EventRowProps {
  event: CalendarEvent;
}

const IMPACT_BADGE: Record<string, string> = {
  High: "bg-red-600 text-white",
  Medium: "bg-orange-500 text-white",
  Low: "bg-muted-foreground text-background",
  Holiday: "bg-blue-500 text-white",
  "Non-Economic": "bg-muted text-muted-foreground",
};

const ROW_BG: Record<string, string> = {
  High: "bg-red-50/70 dark:bg-red-950/20 border-l-red-500",
  Medium: "bg-orange-50/50 dark:bg-orange-950/20 border-l-orange-400",
  Low: "bg-card border-l-border",
  Holiday: "bg-blue-50/50 dark:bg-blue-950/20 border-l-blue-400",
  "Non-Economic": "bg-card border-l-border",
};

export function EventRow({ event }: EventRowProps) {
  const time = formatTime(event.date);
  const flag = getCurrencyFlag(event.currency);
  const impactBadge = IMPACT_BADGE[event.impact] ?? IMPACT_BADGE["Low"];
  const rowBg = ROW_BG[event.impact] ?? ROW_BG["Low"];

  return (
    <>
      <div
        className={cn(
          "hidden md:grid grid-cols-[90px_80px_1fr_90px_90px_90px] items-center px-4 py-3.5 rounded-lg border-l-4 transition-all duration-100 hover:shadow-sm",
          rowBg
        )}
      >
        <span className="text-sm font-medium text-muted-foreground tabular-nums">{time}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-base leading-none">{flag}</span>
          <span className="text-sm font-semibold text-foreground">{event.currency}</span>
        </span>
        <span className="text-sm font-semibold text-foreground truncate pr-4">{event.title}</span>
        <span className="flex justify-center">
          <span className={cn("px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", impactBadge)}>
            {event.impact}
          </span>
        </span>
        <span className="text-sm text-foreground text-right tabular-nums font-medium">{safeValue(event.forecast)}</span>
        <span className="text-sm text-muted-foreground text-right tabular-nums">{safeValue(event.previous)}</span>
      </div>

      <div
        className={cn(
          "md:hidden rounded-lg border-l-4 px-3 py-3 transition-all duration-100",
          rowBg
        )}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{time}</span>
            <span className="flex items-center gap-1">
              <span className="text-sm leading-none">{flag}</span>
              <span className="text-xs font-semibold text-foreground">{event.currency}</span>
            </span>
          </div>
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0", impactBadge)}>
            {event.impact}
          </span>
        </div>

        <p className="text-sm font-semibold text-foreground mb-1.5 leading-snug">{event.title}</p>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Fcst: <span className="font-medium text-foreground">{safeValue(event.forecast)}</span>
          </span>
          <span className="text-muted-foreground">
            Prev: <span className="font-medium text-foreground">{safeValue(event.previous)}</span>
          </span>
        </div>
      </div>
    </>
  );
}
