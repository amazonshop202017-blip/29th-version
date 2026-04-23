import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DayPicker, DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

interface SingleMonthCalendarProps {
  month: Date;
  onMonthChange: (date: Date) => void;
  selected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
}

function SingleMonthCalendar({ month, onMonthChange, selected, onSelect }: SingleMonthCalendarProps) {
  const [monthDropdownOpen, setMonthDropdownOpen] = React.useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = React.useState(false);
  const monthRef = React.useRef<HTMLDivElement>(null);
  const yearRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (monthRef.current && !monthRef.current.contains(e.target as Node)) setMonthDropdownOpen(false);
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) setYearDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToPrevMonth = () => {
    const d = new Date(month);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
  };

  const goToNextMonth = () => {
    const d = new Date(month);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
  };

  const handleMonthSelect = (m: number) => {
    const d = new Date(month);
    d.setMonth(m);
    onMonthChange(d);
    setMonthDropdownOpen(false);
  };

  const handleYearSelect = (y: number) => {
    const d = new Date(month);
    d.setFullYear(y);
    onMonthChange(d);
    setYearDropdownOpen(false);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Custom caption with arrows + dropdowns */}
      <div className="flex items-center justify-between w-full px-1 pb-2">
        <button
          type="button"
          onClick={goToPrevMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          {/* Month dropdown */}
          <div ref={monthRef} className="relative">
            <button
              type="button"
              onClick={() => { setMonthDropdownOpen(!monthDropdownOpen); setYearDropdownOpen(false); }}
              className="flex items-center gap-0.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded px-1.5 py-0.5 transition-colors border-b border-border"
            >
              {MONTH_SHORT[month.getMonth()]}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
            {monthDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 py-1 max-h-48 overflow-y-auto min-w-[80px]">
                {MONTHS.map((name, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleMonthSelect(i)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                      i === month.getMonth() && "bg-accent font-medium"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Year dropdown */}
          <div ref={yearRef} className="relative">
            <button
              type="button"
              onClick={() => { setYearDropdownOpen(!yearDropdownOpen); setMonthDropdownOpen(false); }}
              className="flex items-center gap-0.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded px-1.5 py-0.5 transition-colors border-b border-border"
            >
              {month.getFullYear()}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
            {yearDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 py-1 max-h-48 overflow-y-auto min-w-[70px]">
                {YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => handleYearSelect(y)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                      y === month.getFullYear() && "bg-accent font-medium"
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={goToNextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid only - hide built-in caption */}
      <DayPicker
        mode="range"
        month={month}
        onMonthChange={onMonthChange}
        selected={selected}
        onSelect={onSelect}
        showOutsideDays
        className="pointer-events-auto !p-0"
        classNames={{
          months: "flex flex-col",
          month: "space-y-1",
          caption: "hidden",
          table: "w-full border-collapse",
          head_row: "flex",
          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-1",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
          day_range_end: "day-range-end",
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
        }}
      />
    </div>
  );
}

interface DateRangeCalendarProps {
  selected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangeCalendar({ selected, onSelect, className }: DateRangeCalendarProps) {
  const now = new Date();
  const [leftMonth, setLeftMonth] = React.useState(
    selected?.from ? new Date(selected.from.getFullYear(), selected.from.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [rightMonth, setRightMonth] = React.useState(() => {
    const d = new Date(leftMonth);
    d.setMonth(d.getMonth() + 1);
    return d;
  });

  return (
    <div className={cn("flex flex-col sm:flex-row gap-4 sm:gap-6", className)}>
      <SingleMonthCalendar
        month={leftMonth}
        onMonthChange={setLeftMonth}
        selected={selected}
        onSelect={onSelect}
      />
      <SingleMonthCalendar
        month={rightMonth}
        onMonthChange={setRightMonth}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}
