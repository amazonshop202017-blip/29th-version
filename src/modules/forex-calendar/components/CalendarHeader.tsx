interface CalendarHeaderProps {
  title?: string;
  subtitle?: string;
}

export function CalendarHeader({
  title = "Economic Calendar",
  subtitle = "Focused schedule of market-moving events. High impact events are highlighted for immediate attention.",
}: CalendarHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 uppercase tracking-wider">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
          </span>
          Live
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
        {subtitle}
      </p>
    </div>
  );
}
