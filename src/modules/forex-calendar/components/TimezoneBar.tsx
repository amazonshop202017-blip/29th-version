import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { getUserTimezone, formatTimezone } from "../utils/date.utils";

export function TimezoneBar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const timezone = getUserTimezone();
  const formattedTz = formatTimezone(timezone);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-card rounded-lg border border-border text-[11px] sm:text-xs text-muted-foreground">
        <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate max-w-[140px] sm:max-w-none">
          {formattedTz}
        </span>
        <svg className="h-3 w-3 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <div className="flex items-center bg-card rounded-lg border border-border overflow-hidden">
        <span className="px-2 sm:px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-muted-foreground border-r border-border">
          AM/PM
        </span>
        <span className="px-2 sm:px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-foreground bg-muted">
          24HR
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-card rounded-lg border border-border text-[11px] sm:text-xs font-mono font-semibold text-foreground">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        {timeStr}
      </div>
    </div>
  );
}
