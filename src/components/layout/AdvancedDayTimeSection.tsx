import { useState, ReactNode, useMemo } from 'react';
import { ChevronDown, Clock, Calendar as CalendarIcon2, CalendarDays, Timer, Plus, MinusCircle, LogIn, LogOut } from 'lucide-react';
import TextField from '@mui/material/TextField';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useGlobalFilters, DayFilter, HoldingPeriodFilter, TimeInterval } from '@/contexts/GlobalFiltersContext';
import { useTradesContext } from '@/contexts/TradesContext';
import { AppTimePicker } from '@/components/ui/AppTimePicker';

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00–${i.toString().padStart(2, '0')}:59`,
}));

interface FilterRowProps {
  label: string;
  icon: ReactNode;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function FilterRow({ label, icon, active, expanded, onToggle, children }: FilterRowProps) {
  return (
    <div className="min-w-0 space-y-2">
      <div
        className="flex min-w-0 items-center gap-3 cursor-pointer select-none py-1.5"
        onClick={onToggle}
      >
        <Checkbox
          className="rounded-[4px] h-3.5 w-3.5 shrink-0 [&_svg]:h-3 [&_svg]:w-3"
          checked={active}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={onToggle}
        />
        <span className="min-w-0 truncate text-sm">{label}</span>
      </div>
      {expanded && <div className="ml-6 min-w-0">{children}</div>}
    </div>
  );
}

interface CheckboxMultiSelectProps<T extends string | number> {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  emptyText?: string;
  popoverWidth?: string;
  maxHeight?: string;
}

function CheckboxMultiSelect<T extends string | number>({
  options, selected, onChange, emptyText, popoverWidth = 'w-48', maxHeight = 'max-h-48',
}: CheckboxMultiSelectProps<T>) {
  const label = selected.length === 0 ? 'All' : `${selected.length} selected`;
  const toggle = (v: T) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full min-w-0 h-9 justify-between text-sm font-normal bg-background border-border">
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(popoverWidth, 'max-w-[calc(100vw-4rem)] p-2 bg-popover border-border z-[120]')} align="start">
        <div className={cn('space-y-1 overflow-auto', maxHeight)}>
          {options.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">{emptyText ?? 'No options'}</div>
          ) : options.map((opt) => (
            <div
              key={String(opt.value)}
              className="flex items-center gap-3 px-2 py-2 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => toggle(opt.value)}
            >
              <Checkbox className="rounded-[4px] h-3.5 w-3.5 shrink-0 [&_svg]:h-3 [&_svg]:w-3" checked={selected.includes(opt.value)} />
              <span className="text-sm truncate">{opt.label}</span>
            </div>
          ))}
        </div>
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-2" />
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onChange([])}>
              Clear selection
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface TimeIntervalListProps {
  intervals: TimeInterval[];
  onChange: (next: TimeInterval[]) => void;
}

function TimeIntervalList({ intervals, onChange }: TimeIntervalListProps) {
  const list = intervals.length === 0 ? [{ min: null, max: null }] : intervals;
  const update = (idx: number, patch: Partial<TimeInterval>) => {
    const next = list.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };
  const remove = (idx: number) => onChange(list.filter((_, i) => i !== idx));
  const add = () => onChange([...list, { min: null, max: null }]);

  return (
    <div className="space-y-2">
      {list.map((it, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <AppTimePicker
                label="Min"
                value={it.min ?? ''}
                onChange={(v) => update(idx, { min: v === '' ? null : v })}
              />
            </div>
            <div className="flex-1 min-w-0">
              <AppTimePicker
                label="Max"
                value={it.max ?? ''}
                onChange={(v) => update(idx, { max: v === '' ? null : v })}
              />
            </div>
          </div>
          {list.length > 1 && (
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-destructive hover:opacity-80 shrink-0"
              aria-label="Remove interval"
            >
              <MinusCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={add}
        className="h-8 px-2 text-primary hover:text-primary gap-1"
      >
        Add <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export function AdvancedDayTimeSection() {
  const {
    selectedDays, setSelectedDays,
    selectedHours, setSelectedHours,
    selectedYear, setSelectedYear,
    holdingPeriodFilter, setHoldingPeriodFilter,
    durationMinutesMin, setDurationMinutesMin,
    durationMinutesMax, setDurationMinutesMax,
    entryTimeIntervals, setEntryTimeIntervals,
    exitTimeIntervals, setExitTimeIntervals,
  } = useGlobalFilters();

  const { trades } = useTradesContext();

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    trades.forEach(trade => {
      if (trade.entries && trade.entries.length > 0) {
        const first = [...trade.entries].sort((a, b) =>
          new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )[0];
        if (first?.datetime) years.add(new Date(first.datetime).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [trades]);

  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());
  const [yearOpen, setYearOpen] = useState(false);

  const toggleManual = (key: string, currentlyActive: boolean, clearFn: () => void) => {
    if (currentlyActive) {
      clearFn();
      setManualExpanded(prev => { const n = new Set(prev); n.delete(key); return n; });
    } else {
      setManualExpanded(prev => {
        const n = new Set(prev);
        if (n.has(key)) n.delete(key);
        else n.add(key);
        return n;
      });
    }
  };
  const isExpanded = (key: string, active: boolean) => active || manualExpanded.has(key);

  const handleYearSelect = (year: number | null) => {
    setSelectedYear(year);
    setYearOpen(false);
    if (year === null) {
      setManualExpanded(prev => { const n = new Set(prev); n.delete('year'); return n; });
    }
  };

  return (
    <div className="space-y-1">
      {/* Duration (minutes) */}
      <FilterRow
        label="Duration, minutes"
        icon={<Timer className="w-3.5 h-3.5" />}
        active={durationMinutesMin !== null || durationMinutesMax !== null}
        expanded={isExpanded('duration', durationMinutesMin !== null || durationMinutesMax !== null)}
        onToggle={() => toggleManual(
          'duration',
          durationMinutesMin !== null || durationMinutesMax !== null,
          () => { setDurationMinutesMin(null); setDurationMinutesMax(null); }
        )}
      >
        <div className="flex items-center gap-2">
          <TextField
            size="small"
            type="number"
            label="Min"
            value={durationMinutesMin ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setDurationMinutesMin(v === '' ? null : Math.max(0, Number(v)));
            }}
            slotProps={{ htmlInput: { min: 0 } }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            type="number"
            label="Max"
            value={durationMinutesMax ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setDurationMinutesMax(v === '' ? null : Math.max(0, Number(v)));
            }}
            slotProps={{ htmlInput: { min: 0 } }}
            sx={{ flex: 1 }}
          />
        </div>
      </FilterRow>

      {/* Year */}
      <FilterRow
        label="Year"
        icon={<CalendarIcon2 className="w-3.5 h-3.5" />}
        active={selectedYear !== null}
        expanded={isExpanded('year', selectedYear !== null)}
        onToggle={() => toggleManual('year', selectedYear !== null, () => setSelectedYear(null))}
      >
        <Popover open={yearOpen} onOpenChange={setYearOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
              {selectedYear === null ? 'All' : selectedYear.toString()}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-3 bg-popover border-border z-[120]" align="start">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground text-center mb-2">Select Year</div>
              <div
                className={cn(
                  'px-3 py-2 rounded-md text-center text-sm cursor-pointer transition-colors',
                  selectedYear === null ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => handleYearSelect(null)}
              >
                All Years
              </div>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-2 gap-1.5">
                {(availableYears.length === 0
                  ? [0, 1, 2, 3, 4].map(offset => new Date().getFullYear() - offset)
                  : availableYears
                ).map(year => (
                  <div
                    key={year}
                    className={cn(
                      'px-3 py-2 rounded-md text-center text-sm cursor-pointer transition-colors',
                      selectedYear === year ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                    onClick={() => handleYearSelect(year)}
                  >
                    {year}
                  </div>
                ))}
              </div>
              {selectedYear !== null && (
                <>
                  <DropdownMenuSeparator />
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => handleYearSelect(null)}>
                    Clear selection
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </FilterRow>

      {/* Month (UI only) */}
      <FilterRow
        label="Month"
        icon={<CalendarIcon2 className="w-3.5 h-3.5" />}
        active={false}
        expanded={manualExpanded.has('month')}
        onToggle={() => setManualExpanded(prev => {
          const n = new Set(prev);
          if (n.has('month')) n.delete('month'); else n.add('month');
          return n;
        })}
      >
        <Select>
          <SelectTrigger className="h-9 bg-background border-border">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-[120]">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="1">January</SelectItem>
            <SelectItem value="2">February</SelectItem>
            <SelectItem value="3">March</SelectItem>
            <SelectItem value="4">April</SelectItem>
            <SelectItem value="5">May</SelectItem>
            <SelectItem value="6">June</SelectItem>
            <SelectItem value="7">July</SelectItem>
            <SelectItem value="8">August</SelectItem>
            <SelectItem value="9">September</SelectItem>
            <SelectItem value="10">October</SelectItem>
            <SelectItem value="11">November</SelectItem>
            <SelectItem value="12">December</SelectItem>
          </SelectContent>
        </Select>
      </FilterRow>

      {/* Day */}
      <FilterRow
        label="Day"
        icon={<CalendarIcon2 className="w-3.5 h-3.5" />}
        active={selectedDays.length > 0}
        expanded={isExpanded('day', selectedDays.length > 0)}
        onToggle={() => toggleManual('day', selectedDays.length > 0, () => setSelectedDays([]))}
      >
        <CheckboxMultiSelect
          options={DAY_OPTIONS}
          selected={selectedDays}
          onChange={setSelectedDays}
          popoverWidth="w-40"
        />
      </FilterRow>

      {/* Hour */}
      <FilterRow
        label="Hour"
        icon={<Clock className="w-3.5 h-3.5" />}
        active={selectedHours.length > 0}
        expanded={isExpanded('hour', selectedHours.length > 0)}
        onToggle={() => toggleManual('hour', selectedHours.length > 0, () => setSelectedHours([]))}
      >
        <CheckboxMultiSelect
          options={HOUR_OPTIONS}
          selected={selectedHours}
          onChange={setSelectedHours}
          popoverWidth="w-44"
        />
      </FilterRow>

      {/* Entry Time */}
      <FilterRow
        label="Entry time"
        icon={<LogIn className="w-3.5 h-3.5" />}
        active={entryTimeIntervals.some(i => i.min || i.max)}
        expanded={isExpanded('entryTime', entryTimeIntervals.some(i => i.min || i.max))}
        onToggle={() => toggleManual(
          'entryTime',
          entryTimeIntervals.some(i => i.min || i.max),
          () => setEntryTimeIntervals([])
        )}
      >
        <TimeIntervalList intervals={entryTimeIntervals} onChange={setEntryTimeIntervals} />
      </FilterRow>

      {/* Exit Time */}
      <FilterRow
        label="Exit time"
        icon={<LogOut className="w-3.5 h-3.5" />}
        active={exitTimeIntervals.some(i => i.min || i.max)}
        expanded={isExpanded('exitTime', exitTimeIntervals.some(i => i.min || i.max))}
        onToggle={() => toggleManual(
          'exitTime',
          exitTimeIntervals.some(i => i.min || i.max),
          () => setExitTimeIntervals([])
        )}
      >
        <TimeIntervalList intervals={exitTimeIntervals} onChange={setExitTimeIntervals} />
      </FilterRow>

      {/* Intraday / Multiday */}
      <FilterRow
        label="Intraday/Multiday"
        icon={<CalendarDays className="w-3.5 h-3.5" />}
        active={holdingPeriodFilter !== 'all'}
        expanded={isExpanded('holding', holdingPeriodFilter !== 'all')}
        onToggle={() => toggleManual('holding', holdingPeriodFilter !== 'all', () => setHoldingPeriodFilter('all'))}
      >
        <Select
          value={holdingPeriodFilter}
          onValueChange={(v) => setHoldingPeriodFilter(v as HoldingPeriodFilter)}
        >
          <SelectTrigger className="h-9 bg-background border-border">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-[120]">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="intraday">Intraday</SelectItem>
            <SelectItem value="multiday">Multiday</SelectItem>
          </SelectContent>
        </Select>
      </FilterRow>
    </div>
  );
}