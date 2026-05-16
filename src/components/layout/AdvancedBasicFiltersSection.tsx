import { useState, useMemo, ReactNode } from 'react';
import {
  ChevronDown, Check, Globe, BarChart2, ListFilter, TrendingUp,
  Clock, Hash, Calendar as CalendarIcon2, Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  useGlobalFilters, OutcomeFilter, DayFilter, LastTradesFilter,
  DirectionFilter, ReturnPercentRange, RMultipleRange,
} from '@/contexts/GlobalFiltersContext';
import { useTradesContext } from '@/contexts/TradesContext';
import { useStrategiesContext } from '@/contexts/StrategiesContext';

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const OUTCOME_OPTIONS: { value: OutcomeFilter; label: string }[] = [
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'breakeven', label: 'Breakeven' },
];

const DIRECTION_OPTIONS: { value: DirectionFilter; label: string }[] = [
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
];

const LAST_TRADES_OPTIONS: { value: LastTradesFilter; label: string }[] = [
  { value: 10, label: 'Last 10' },
  { value: 25, label: 'Last 25' },
  { value: 50, label: 'Last 50' },
  { value: 100, label: 'Last 100' },
];

const RETURN_PERCENT_OPTIONS: { value: ReturnPercentRange; label: string }[] = [
  { value: '<0', label: '< 0%' },
  { value: '0-1', label: '0% – 1%' },
  { value: '1-2', label: '1% – 2%' },
  { value: '3-5', label: '3% – 5%' },
  { value: '5-10', label: '5% – 10%' },
  { value: '>10', label: '> 10%' },
];

const R_MULTIPLE_OPTIONS: { value: RMultipleRange; label: string }[] = [
  { value: '<-2', label: '< -2R' },
  { value: '-2-0', label: '-2R to 0R' },
  { value: '0-1', label: '0R to 1R' },
  { value: '1-2', label: '1R to 2R' },
  { value: '2-4', label: '2R to 4R' },
  { value: '>4', label: '> 4R' },
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
  children?: ReactNode;
  emptyMessage?: string;
}

function FilterRow({ label, icon, active, expanded, onToggle, children, emptyMessage }: FilterRowProps) {
  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={onToggle}
      >
        <Checkbox
          checked={active}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={onToggle}
        />
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      {expanded && (
        <div className="ml-6">
          {children ?? (
            emptyMessage && <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface Option<T> { value: T; label: string }

interface MultiSelectProps<T> {
  options: Option<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  width?: string;
}

function MultiSelectPopover<T extends string | number>({
  options, selected, onChange, placeholder, searchPlaceholder = 'Search...', emptyText = 'No results.', width = 'w-[260px]',
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const label = selected.length === 0
    ? placeholder
    : selected.length === options.length
      ? 'All selected'
      : `${selected.length} selected`;

  const toggle = (v: T) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-9 text-sm bg-background border-border font-normal"
        >
          {label}
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(width, 'p-0 bg-popover border-border z-[100]')} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <CommandItem
                    key={String(opt.value)}
                    onSelect={() => toggle(opt.value)}
                    className="cursor-pointer"
                  >
                    <div className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                      checked ? 'bg-primary text-primary-foreground' : 'opacity-50'
                    )}>
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <span>{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface SingleSelectProps<T> {
  options: Option<T>[];
  value: T | null;
  onChange: (next: T | null) => void;
  placeholder: string;
}

function SingleSelectPopover<T extends string | number>({ options, value, onChange, placeholder }: SingleSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-9 text-sm bg-background border-border font-normal"
        >
          {current?.label ?? placeholder}
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-1 bg-popover border-border z-[100]" align="start">
        <div className="space-y-0.5">
          {options.map((opt) => (
            <div
              key={String(opt.value)}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'px-2 py-1.5 rounded text-sm cursor-pointer',
                value === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {opt.label}
            </div>
          ))}
          {value !== null && (
            <>
              <div className="h-px bg-border my-1" />
              <div
                onClick={() => { onChange(null); setOpen(false); }}
                className="px-2 py-1.5 rounded text-sm cursor-pointer text-muted-foreground hover:bg-accent"
              >
                Clear selection
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AdvancedBasicFiltersSection() {
  const {
    selectedSymbols, setSelectedSymbols,
    selectedSetups, setSelectedSetups,
    selectedChecklistItems, setSelectedChecklistItems,
    selectedOutcomes, setSelectedOutcomes,
    selectedDirections, setSelectedDirections,
    selectedDays, setSelectedDays,
    selectedHours, setSelectedHours,
    lastTradesFilter, setLastTradesFilter,
    selectedYear, setSelectedYear,
    selectedReturnRanges, setSelectedReturnRanges,
    selectedRMultipleRanges, setSelectedRMultipleRanges,
  } = useGlobalFilters();

  const { trades } = useTradesContext();
  const { strategies } = useStrategiesContext();

  const availableSymbols = useMemo(() => {
    const s = new Set(trades.map(t => t.symbol));
    return Array.from(s).filter(Boolean).sort();
  }, [trades]);

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

  const availableChecklistItems = useMemo(() => {
    if (selectedSetups.length === 0) return [];
    const items = new Set<string>();
    strategies
      .filter(s => selectedSetups.includes(s.id))
      .forEach(s => s.checklistItems?.forEach(i => items.add(i)));
    return Array.from(items);
  }, [strategies, selectedSetups]);

  // Manual expand toggles for rows whose value is currently empty
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());
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

  const symbolOptions = availableSymbols.map(s => ({ value: s, label: s }));
  const setupOptions = strategies.map(s => ({ value: s.id, label: s.name }));
  const checklistOptions = availableChecklistItems.map(i => ({ value: i, label: i }));
  const yearOptions = (availableYears.length > 0
    ? availableYears
    : [0, 1, 2, 3, 4].map(o => new Date().getFullYear() - o)
  ).map(y => ({ value: y, label: String(y) }));

  return (
    <div className="space-y-3">
      <FilterRow
        label="Symbol"
        icon={<Globe className="w-3.5 h-3.5" />}
        active={selectedSymbols.length > 0}
        expanded={isExpanded('symbol', selectedSymbols.length > 0)}
        onToggle={() => toggleManual('symbol', selectedSymbols.length > 0, () => setSelectedSymbols([]))}
        emptyMessage="No symbols found"
      >
        {symbolOptions.length > 0 && (
          <MultiSelectPopover
            options={symbolOptions}
            selected={selectedSymbols}
            onChange={setSelectedSymbols}
            placeholder="Select symbols"
            searchPlaceholder="Search symbols..."
            emptyText="No symbols."
          />
        )}
      </FilterRow>

      <FilterRow
        label="Setup"
        icon={<BarChart2 className="w-3.5 h-3.5" />}
        active={selectedSetups.length > 0}
        expanded={isExpanded('setup', selectedSetups.length > 0)}
        onToggle={() => toggleManual('setup', selectedSetups.length > 0, () => setSelectedSetups([]))}
        emptyMessage="No setups found"
      >
        {setupOptions.length > 0 && (
          <MultiSelectPopover
            options={setupOptions}
            selected={selectedSetups}
            onChange={setSelectedSetups}
            placeholder="Select setups"
            searchPlaceholder="Search setups..."
            emptyText="No setups."
          />
        )}
      </FilterRow>

      <FilterRow
        label="Checklist of Setup"
        icon={<ListFilter className="w-3.5 h-3.5" />}
        active={selectedChecklistItems.length > 0}
        expanded={isExpanded('checklist', selectedChecklistItems.length > 0)}
        onToggle={() => toggleManual('checklist', selectedChecklistItems.length > 0, () => setSelectedChecklistItems([]))}
        emptyMessage={selectedSetups.length === 0 ? 'Select a setup first' : 'No checklist items'}
      >
        {selectedSetups.length === 0 ? (
          <p className="text-xs text-muted-foreground">Select a setup first</p>
        ) : checklistOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No checklist items for selected setups</p>
        ) : (
          <MultiSelectPopover
            options={checklistOptions}
            selected={selectedChecklistItems}
            onChange={setSelectedChecklistItems}
            placeholder="Select checklist items"
            searchPlaceholder="Search items..."
            emptyText="No items."
          />
        )}
      </FilterRow>

      <FilterRow
        label="Outcome"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        active={selectedOutcomes.length > 0}
        expanded={isExpanded('outcome', selectedOutcomes.length > 0)}
        onToggle={() => toggleManual('outcome', selectedOutcomes.length > 0, () => setSelectedOutcomes([]))}
      >
        <MultiSelectPopover
          options={OUTCOME_OPTIONS}
          selected={selectedOutcomes}
          onChange={setSelectedOutcomes}
          placeholder="Select outcomes"
        />
      </FilterRow>

      <FilterRow
        label="Direction"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        active={selectedDirections.length > 0}
        expanded={isExpanded('direction', selectedDirections.length > 0)}
        onToggle={() => toggleManual('direction', selectedDirections.length > 0, () => setSelectedDirections([]))}
      >
        <MultiSelectPopover
          options={DIRECTION_OPTIONS}
          selected={selectedDirections}
          onChange={setSelectedDirections}
          placeholder="Select direction"
        />
      </FilterRow>

      <FilterRow
        label="Day of Week"
        icon={<CalendarIcon2 className="w-3.5 h-3.5" />}
        active={selectedDays.length > 0}
        expanded={isExpanded('day', selectedDays.length > 0)}
        onToggle={() => toggleManual('day', selectedDays.length > 0, () => setSelectedDays([]))}
      >
        <MultiSelectPopover
          options={DAY_OPTIONS}
          selected={selectedDays}
          onChange={setSelectedDays}
          placeholder="Select days"
        />
      </FilterRow>

      <FilterRow
        label="Hour"
        icon={<Clock className="w-3.5 h-3.5" />}
        active={selectedHours.length > 0}
        expanded={isExpanded('hour', selectedHours.length > 0)}
        onToggle={() => toggleManual('hour', selectedHours.length > 0, () => setSelectedHours([]))}
      >
        <MultiSelectPopover
          options={HOUR_OPTIONS}
          selected={selectedHours}
          onChange={setSelectedHours}
          placeholder="Select hours"
          searchPlaceholder="Search hours..."
        />
      </FilterRow>

      <FilterRow
        label="Last Trades"
        icon={<Hash className="w-3.5 h-3.5" />}
        active={lastTradesFilter !== null}
        expanded={isExpanded('last', lastTradesFilter !== null)}
        onToggle={() => toggleManual('last', lastTradesFilter !== null, () => setLastTradesFilter(null))}
      >
        <SingleSelectPopover
          options={LAST_TRADES_OPTIONS.filter(o => o.value !== null) as { value: number; label: string }[]}
          value={lastTradesFilter}
          onChange={(v) => setLastTradesFilter(v as LastTradesFilter)}
          placeholder="Select count"
        />
      </FilterRow>

      <FilterRow
        label="Year"
        icon={<CalendarIcon2 className="w-3.5 h-3.5" />}
        active={selectedYear !== null}
        expanded={isExpanded('year', selectedYear !== null)}
        onToggle={() => toggleManual('year', selectedYear !== null, () => setSelectedYear(null))}
      >
        <SingleSelectPopover
          options={yearOptions}
          value={selectedYear}
          onChange={(v) => setSelectedYear(v)}
          placeholder="Select year"
        />
      </FilterRow>

      <FilterRow
        label="Return %"
        icon={<Percent className="w-3.5 h-3.5" />}
        active={selectedReturnRanges.length > 0}
        expanded={isExpanded('ret', selectedReturnRanges.length > 0)}
        onToggle={() => toggleManual('ret', selectedReturnRanges.length > 0, () => setSelectedReturnRanges([]))}
      >
        <MultiSelectPopover
          options={RETURN_PERCENT_OPTIONS}
          selected={selectedReturnRanges}
          onChange={setSelectedReturnRanges}
          placeholder="Select ranges"
        />
      </FilterRow>

      <FilterRow
        label="R-Multiple"
        icon={<Hash className="w-3.5 h-3.5" />}
        active={selectedRMultipleRanges.length > 0}
        expanded={isExpanded('rmult', selectedRMultipleRanges.length > 0)}
        onToggle={() => toggleManual('rmult', selectedRMultipleRanges.length > 0, () => setSelectedRMultipleRanges([]))}
      >
        <MultiSelectPopover
          options={R_MULTIPLE_OPTIONS}
          selected={selectedRMultipleRanges}
          onChange={setSelectedRMultipleRanges}
          placeholder="Select ranges"
        />
      </FilterRow>
    </div>
  );
}
