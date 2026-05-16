import { useState, ReactNode, useMemo } from 'react';
import { ChevronDown, BarChart2, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useStrategiesContext } from '@/contexts/StrategiesContext';

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
          className="rounded-[4px] h-3.5 w-3.5 [&_svg]:h-3 [&_svg]:w-3"
          checked={active}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={onToggle}
        />
        <span className="text-sm">{label}</span>
      </div>
      {expanded && <div className="ml-6">{children}</div>}
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
              <Checkbox className="rounded-[4px] h-3.5 w-3.5 [&_svg]:h-3 [&_svg]:w-3" checked={selected.includes(opt.value)} />
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

export function AdvancedStrategySection() {
  const {
    selectedSetups, setSelectedSetups,
    excludedSetups, setExcludedSetups,
    selectedChecklistItems, setSelectedChecklistItems,
    excludedChecklistItems, setExcludedChecklistItems,
  } = useGlobalFilters();

  const { strategies } = useStrategiesContext();

  const availableChecklistItems = useMemo(() => {
    if (selectedSetups.length === 0) return [];
    const items = new Set<string>();
    strategies
      .filter(s => selectedSetups.includes(s.id))
      .forEach(s => s.checklistItems?.forEach(i => items.add(i)));
    return Array.from(items);
  }, [strategies, selectedSetups]);

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
      {/* Setup (with nested Excluding) */}
      <FilterRow
        label="Setup"
        icon={<BarChart2 className="w-3.5 h-3.5" />}
        active={selectedSetups.length > 0 || excludedSetups.length > 0}
        expanded={isExpanded('setup', selectedSetups.length > 0 || excludedSetups.length > 0)}
        onToggle={() => toggleManual(
          'setup',
          selectedSetups.length > 0 || excludedSetups.length > 0,
          () => { setSelectedSetups([]); setExcludedSetups([]); },
        )}
      >
        {/* Tree-branched Including + Excluding under Setup checkbox.
            Shared vertical line ends at the last (Excluding) branch. */}
        <div className="relative ml-1 pl-4 space-y-3">
          {/* Shared vertical line: from top down to the Excluding label center */}
          <div
            aria-hidden
            className="absolute left-0 top-0 w-px bg-[#bdbdbd] pointer-events-none"
            style={{ height: 'calc(100% - 1.125rem)' }}
          />

          {/* Including branch */}
          <div className="relative">
            <svg
              aria-hidden
              width="16"
              height="12"
              viewBox="0 0 16 12"
              fill="none"
              className="absolute -left-4 top-1/2 -translate-y-[6px] text-[#bdbdbd] pointer-events-none"
            >
              <path d="M 0.5 0 L 0.5 11.5 L 16 11.5" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
            <label className="text-xs text-muted-foreground block mb-1.5">Including</label>
            <CheckboxMultiSelect
              options={strategies.map(s => ({ value: s.id, label: s.name }))}
              selected={selectedSetups}
              onChange={setSelectedSetups}
              emptyText="No setups found"
            />
          </div>

          {/* Excluding branch (last — L-curve ending) */}
          <div className="relative">
            <svg
              aria-hidden
              width="16"
              height="12"
              viewBox="0 0 16 12"
              fill="none"
              className="absolute -left-4 top-1/2 -translate-y-[6px] text-[#bdbdbd] pointer-events-none"
            >
              <path
                d="M 0.5 0 L 0.5 6 Q 0.5 11.5, 6 11.5 L 16 11.5"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
              />
            </svg>
            <label className="text-xs text-muted-foreground block mb-1.5">Excluding</label>
            <CheckboxMultiSelect
              options={strategies.map(s => ({ value: s.id, label: s.name }))}
              selected={excludedSetups}
              onChange={setExcludedSetups}
              emptyText="No setups found"
            />
          </div>
        </div>
      </FilterRow>

      {/* Checklist of Setup */}
      <FilterRow
        label="Checklist of Setup"
        icon={<ListFilter className="w-3.5 h-3.5" />}
        active={selectedChecklistItems.length > 0 || excludedChecklistItems.length > 0}
        expanded={isExpanded('checklist', selectedChecklistItems.length > 0 || excludedChecklistItems.length > 0)}
        onToggle={() => toggleManual(
          'checklist',
          selectedChecklistItems.length > 0 || excludedChecklistItems.length > 0,
          () => { setSelectedChecklistItems([]); setExcludedChecklistItems([]); },
        )}
      >
        {selectedSetups.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            Please select a setup first to choose checklist items.
          </div>
        ) : (
          <div className="relative ml-1 pl-4 space-y-3">
            {/* Shared vertical line */}
            <div
              aria-hidden
              className="absolute left-0 top-0 w-px bg-[#bdbdbd] pointer-events-none"
              style={{ height: 'calc(100% - 1.125rem)' }}
            />

            {/* Including branch */}
            <div className="relative">
              <svg
                aria-hidden
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="none"
                className="absolute -left-4 top-1/2 -translate-y-[6px] text-[#bdbdbd] pointer-events-none"
              >
                <path d="M 0.5 0 L 0.5 11.5 L 16 11.5" stroke="currentColor" strokeWidth="1" fill="none" />
              </svg>
              <label className="text-xs text-muted-foreground block mb-1.5">Including</label>
              <CheckboxMultiSelect
                options={availableChecklistItems.map(i => ({ value: i, label: i }))}
                selected={selectedChecklistItems}
                onChange={setSelectedChecklistItems}
                emptyText="No checklist items for selected setups"
                popoverWidth="w-56"
              />
            </div>

            {/* Excluding branch */}
            <div className="relative">
              <svg
                aria-hidden
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="none"
                className="absolute -left-4 top-1/2 -translate-y-[6px] text-[#bdbdbd] pointer-events-none"
              >
                <path
                  d="M 0.5 0 L 0.5 6 Q 0.5 11.5, 6 11.5 L 16 11.5"
                  stroke="currentColor"
                  strokeWidth="1"
                  fill="none"
                />
              </svg>
              <label className="text-xs text-muted-foreground block mb-1.5">Excluding</label>
              <CheckboxMultiSelect
                options={availableChecklistItems.map(i => ({ value: i, label: i }))}
                selected={excludedChecklistItems}
                onChange={setExcludedChecklistItems}
                emptyText="No checklist items for selected setups"
                popoverWidth="w-56"
              />
            </div>
          </div>
        )}
      </FilterRow>
    </div>
  );
}