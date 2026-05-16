import { useState, ReactNode, useMemo } from 'react';
import {
  ChevronDown, Globe, TrendingUp,
  Hash, Percent, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  useGlobalFilters, OutcomeFilter, LastTradesFilter,
  DirectionFilter, ReturnPercentRange, RMultipleRange,
} from '@/contexts/GlobalFiltersContext';
import { useTradesContext } from '@/contexts/TradesContext';

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
  { value: null, label: 'All' },
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
    <div className="space-y-2">
      <div
        className="flex items-center gap-3 cursor-pointer select-none py-1.5"
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
      {expanded && <div className="ml-6">{children}</div>}
    </div>
  );
}

/**
 * Multi-select popover using the SAME checkbox-list pattern as the basic
 * filters popover in GlobalHeader (no Command search input).
 */
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
        <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
          {label}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(popoverWidth, 'p-2 bg-popover border-border z-[120]')} align="start">
        <div className={cn('space-y-1 overflow-auto', maxHeight)}>
          {options.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">{emptyText ?? 'No options'}</div>
          ) : options.map((opt) => (
            <div
              key={String(opt.value)}
              className="flex items-center gap-3 px-2 py-2 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => toggle(opt.value)}
            >
              <Checkbox className="rounded-none" checked={selected.includes(opt.value)} />
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

export function AdvancedBasicFiltersSection() {
  const {
    selectedSymbols, setSelectedSymbols,
    selectedOutcomes, setSelectedOutcomes,
    selectedDirections, setSelectedDirections,
    lastTradesFilter, setLastTradesFilter,
    selectedReturnRanges, setSelectedReturnRanges,
    selectedRMultipleRanges, setSelectedRMultipleRanges,
  } = useGlobalFilters();

  const { trades } = useTradesContext();

  const availableSymbols = useMemo(() => {
    const s = new Set(trades.map(t => t.symbol));
    return Array.from(s).filter(Boolean).sort();
  }, [trades]);

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

  return (
    <div className="space-y-1">
      {/* Symbol */}
      <FilterRow
        label="Symbol"
        icon={<Globe className="w-3.5 h-3.5" />}
        active={selectedSymbols.length > 0}
        expanded={isExpanded('symbol', selectedSymbols.length > 0)}
        onToggle={() => toggleManual('symbol', selectedSymbols.length > 0, () => setSelectedSymbols([]))}
      >
        <CheckboxMultiSelect
          options={availableSymbols.map(s => ({ value: s, label: s }))}
          selected={selectedSymbols}
          onChange={setSelectedSymbols}
          emptyText="No symbols found"
        />
      </FilterRow>

      {/* Outcome */}
      <FilterRow
        label="Outcome"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        active={selectedOutcomes.length > 0}
        expanded={isExpanded('outcome', selectedOutcomes.length > 0)}
        onToggle={() => toggleManual('outcome', selectedOutcomes.length > 0, () => setSelectedOutcomes([]))}
      >
        <CheckboxMultiSelect
          options={OUTCOME_OPTIONS}
          selected={selectedOutcomes}
          onChange={setSelectedOutcomes}
          popoverWidth="w-40"
        />
      </FilterRow>

      {/* Direction */}
      <FilterRow
        label="Direction"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        active={selectedDirections.length > 0}
        expanded={isExpanded('direction', selectedDirections.length > 0)}
        onToggle={() => toggleManual('direction', selectedDirections.length > 0, () => setSelectedDirections([]))}
      >
        <CheckboxMultiSelect
          options={DIRECTION_OPTIONS}
          selected={selectedDirections}
          onChange={setSelectedDirections}
          popoverWidth="w-36"
        />
      </FilterRow>

      {/* Starred (UI only) */}
      <FilterRow
        label="Starred"
        icon={<Star className="w-3.5 h-3.5" />}
        active={false}
        expanded={manualExpanded.has('starred')}
        onToggle={() => setManualExpanded(prev => {
          const n = new Set(prev);
          if (n.has('starred')) n.delete('starred'); else n.add('starred');
          return n;
        })}
      >
        <Select>
          <SelectTrigger className="h-9 bg-background border-border">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-[120]">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="starred">Starred Only</SelectItem>
            <SelectItem value="unstarred">Unstarred Only</SelectItem>
          </SelectContent>
        </Select>
      </FilterRow>

      {/* Last Trades */}
      <FilterRow
        label="Last Trades"
        icon={<Hash className="w-3.5 h-3.5" />}
        active={lastTradesFilter !== null}
        expanded={isExpanded('last', lastTradesFilter !== null)}
        onToggle={() => toggleManual('last', lastTradesFilter !== null, () => setLastTradesFilter(null))}
      >
        <Select
          value={lastTradesFilter === null ? 'all' : lastTradesFilter.toString()}
          onValueChange={(v) => setLastTradesFilter(v === 'all' ? null : parseInt(v) as LastTradesFilter)}
        >
          <SelectTrigger className="h-9 bg-background border-border">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-[120]">
            {LAST_TRADES_OPTIONS.map((opt) => (
              <SelectItem key={opt.label} value={opt.value === null ? 'all' : opt.value.toString()}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      {/* Return % */}
      <FilterRow
        label="Return %"
        icon={<Percent className="w-3.5 h-3.5" />}
        active={selectedReturnRanges.length > 0}
        expanded={isExpanded('ret', selectedReturnRanges.length > 0)}
        onToggle={() => toggleManual('ret', selectedReturnRanges.length > 0, () => setSelectedReturnRanges([]))}
      >
        <CheckboxMultiSelect
          options={RETURN_PERCENT_OPTIONS}
          selected={selectedReturnRanges}
          onChange={setSelectedReturnRanges}
          popoverWidth="w-36"
        />
      </FilterRow>

      {/* R-Multiple Gain */}
      <FilterRow
        label="R-Multiple Gain"
        icon={<Hash className="w-3.5 h-3.5" />}
        active={selectedRMultipleRanges.length > 0}
        expanded={isExpanded('rmult', selectedRMultipleRanges.length > 0)}
        onToggle={() => toggleManual('rmult', selectedRMultipleRanges.length > 0, () => setSelectedRMultipleRanges([]))}
      >
        <CheckboxMultiSelect
          options={R_MULTIPLE_OPTIONS}
          selected={selectedRMultipleRanges}
          onChange={setSelectedRMultipleRanges}
          popoverWidth="w-36"
        />
      </FilterRow>

      {/* RRR (UI only) */}
      <FilterRow
        label="RRR"
        icon={<Percent className="w-3.5 h-3.5" />}
        active={false}
        expanded={manualExpanded.has('rrr')}
        onToggle={() => setManualExpanded(prev => {
          const n = new Set(prev);
          if (n.has('rrr')) n.delete('rrr'); else n.add('rrr');
          return n;
        })}
      >
        <Select>
          <SelectTrigger className="h-9 bg-background border-border">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-[120]">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="1">1:1</SelectItem>
            <SelectItem value="2">1:2</SelectItem>
            <SelectItem value="3">1:3+</SelectItem>
          </SelectContent>
        </Select>
      </FilterRow>
    </div>
  );
}