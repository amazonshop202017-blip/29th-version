import { useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGlobalFilters, DayFilter, OutcomeFilter, DirectionFilter, ReturnPercentRange } from '@/contexts/GlobalFiltersContext';
import { useStrategiesContext } from '@/contexts/StrategiesContext';
import { useCategoriesContext } from '@/contexts/CategoriesContext';
import { useTagsContext } from '@/contexts/TagsContext';

interface FilterChip {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
}

const DAY_LABELS: Record<DayFilter, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const OUTCOME_LABELS: Record<OutcomeFilter, string> = {
  win: 'Win', loss: 'Loss', breakeven: 'Breakeven',
};

const DIRECTION_LABELS: Record<DirectionFilter, string> = {
  long: 'Long', short: 'Short',
};

const RETURN_LABELS: Record<ReturnPercentRange, string> = {
  '<0': '< 0%', '0-1': '0–1%', '1-2': '1–2%', '3-5': '3–5%', '5-10': '5–10%', '>10': '> 10%',
};

export const SelectedFiltersBar = () => {
  const location = useLocation();
  const isToolsRoute = location.pathname.startsWith('/tools');
  const {
    selectedSymbols, setSelectedSymbols,
    selectedOutcomes, setSelectedOutcomes,
    selectedHours, setSelectedHours,
    selectedSetups, setSelectedSetups,
    excludedSetups, setExcludedSetups,
    selectedDays, setSelectedDays,
    lastTradesFilter, setLastTradesFilter,
    selectedDirections, setSelectedDirections,
    selectedReturnRanges, setSelectedReturnRanges,
    rMultipleMin, setRMultipleMin,
    rMultipleMax, setRMultipleMax,
    positionSizeMin, setPositionSizeMin,
    positionSizeMax, setPositionSizeMax,
    holdingPeriodFilter, setHoldingPeriodFilter,
    durationMinutesMin, setDurationMinutesMin,
    durationMinutesMax, setDurationMinutesMax,
    entryTimeIntervals, setEntryTimeIntervals,
    exitTimeIntervals, setExitTimeIntervals,
    selectedYear, setSelectedYear,
    selectedChecklistItems, setSelectedChecklistItems,
    excludedChecklistItems, setExcludedChecklistItems,
    selectedTagsByCategory, setSelectedTagsByCategory,
    selectedTradeComments, setSelectedTradeComments,
    selectedAccounts, setSelectedAccounts,
    datePreset, applyDatePreset,
  } = useGlobalFilters();

  const { strategies } = useStrategiesContext();
  const { categories } = useCategoriesContext();
  const { tags } = useTagsContext();

  const chips = useMemo<FilterChip[]>(() => {
    const result: FilterChip[] = [];

    // Date preset
    if (datePreset !== 'all') {
      const presetLabels: Record<string, string> = {
        today: 'Today', this_week: 'This Week', this_month: 'This Month',
        last_30_days: 'Last 30 Days', last_month: 'Last Month',
        this_quarter: 'This Quarter', ytd: 'YTD', custom: 'Custom Range',
      };
      result.push({
        id: 'date', label: 'Date', value: presetLabels[datePreset] || datePreset,
        onRemove: () => applyDatePreset('all'),
      });
    }

    // Accounts — excluded from selected filters bar (still works in filtering)

    // Symbols
    selectedSymbols.forEach(sym => {
      result.push({
        id: `symbol-${sym}`, label: 'Symbol', value: sym,
        onRemove: () => setSelectedSymbols(selectedSymbols.filter(s => s !== sym)),
      });
    });

    // Setups
    selectedSetups.forEach(setupId => {
      const name = strategies.find(s => s.id === setupId)?.name || setupId;
      result.push({
        id: `setup-${setupId}`, label: 'Setup', value: name,
        onRemove: () => setSelectedSetups(selectedSetups.filter(s => s !== setupId)),
      });
    });

    // Excluded Setups
    excludedSetups.forEach(setupId => {
      const name = strategies.find(s => s.id === setupId)?.name || setupId;
      result.push({
        id: `setup-excl-${setupId}`, label: 'Excluding Setup', value: name,
        onRemove: () => setExcludedSetups(excludedSetups.filter(s => s !== setupId)),
      });
    });

    // Checklist items
    selectedChecklistItems.forEach(item => {
      result.push({
        id: `checklist-${item}`, label: 'Checklist', value: item,
        onRemove: () => setSelectedChecklistItems(selectedChecklistItems.filter(i => i !== item)),
      });
    });

    // Excluded Checklist items
    excludedChecklistItems.forEach(item => {
      result.push({
        id: `checklist-excl-${item}`, label: 'Excluding Checklist', value: item,
        onRemove: () => setExcludedChecklistItems(excludedChecklistItems.filter(i => i !== item)),
      });
    });

    // Outcomes
    selectedOutcomes.forEach(o => {
      result.push({
        id: `outcome-${o}`, label: 'Outcome', value: OUTCOME_LABELS[o],
        onRemove: () => setSelectedOutcomes(selectedOutcomes.filter(x => x !== o)),
      });
    });

    // Directions
    selectedDirections.forEach(d => {
      result.push({
        id: `direction-${d}`, label: 'Direction', value: DIRECTION_LABELS[d],
        onRemove: () => setSelectedDirections(selectedDirections.filter(x => x !== d)),
      });
    });

    // Year
    if (selectedYear !== null) {
      result.push({
        id: 'year', label: 'Year', value: selectedYear.toString(),
        onRemove: () => setSelectedYear(null),
      });
    }

    // Days
    selectedDays.forEach(d => {
      result.push({
        id: `day-${d}`, label: 'Day', value: DAY_LABELS[d],
        onRemove: () => setSelectedDays(selectedDays.filter(x => x !== d)),
      });
    });

    // Hours
    selectedHours.forEach(h => {
      result.push({
        id: `hour-${h}`, label: 'Hour', value: `${h.toString().padStart(2, '0')}:00`,
        onRemove: () => setSelectedHours(selectedHours.filter(x => x !== h)),
      });
    });

    // Last trades
    if (lastTradesFilter !== null) {
      result.push({
        id: 'last-trades', label: 'Last Trades', value: lastTradesFilter.toString(),
        onRemove: () => setLastTradesFilter(null),
      });
    }

    // Return %
    selectedReturnRanges.forEach(r => {
      result.push({
        id: `return-${r}`, label: 'Return %', value: RETURN_LABELS[r],
        onRemove: () => setSelectedReturnRanges(selectedReturnRanges.filter(x => x !== r)),
      });
    });

    // R-Multiple (Min/Max)
    if (rMultipleMin !== null || rMultipleMax !== null) {
      const minLabel = rMultipleMin === null ? '−∞' : `${rMultipleMin}`;
      const maxLabel = rMultipleMax === null ? '+∞' : `${rMultipleMax}`;
      result.push({
        id: 'rmultiple-range', label: 'R-Multiple',
        value: `${minLabel} to ${maxLabel} R`,
        onRemove: () => { setRMultipleMin(null); setRMultipleMax(null); },
      });
    }

    // Position Size (Min/Max qty)
    if (positionSizeMin !== null || positionSizeMax !== null) {
      const minLabel = positionSizeMin === null ? '−∞' : `${positionSizeMin}`;
      const maxLabel = positionSizeMax === null ? '+∞' : `${positionSizeMax}`;
      result.push({
        id: 'position-size-range', label: 'Position Size',
        value: `${minLabel} to ${maxLabel} qty`,
        onRemove: () => { setPositionSizeMin(null); setPositionSizeMax(null); },
      });
    }

    // Holding period
    if (holdingPeriodFilter !== 'all') {
      result.push({
        id: 'holding-period', label: 'Holding',
        value: holdingPeriodFilter === 'intraday' ? 'Intraday' : 'Multiday',
        onRemove: () => setHoldingPeriodFilter('all'),
      });
    }

    // Duration (minutes) Min/Max
    if (durationMinutesMin !== null || durationMinutesMax !== null) {
      const minLabel = durationMinutesMin === null ? '−∞' : `${durationMinutesMin}`;
      const maxLabel = durationMinutesMax === null ? '+∞' : `${durationMinutesMax}`;
      result.push({
        id: 'duration-range', label: 'Duration',
        value: `${minLabel} to ${maxLabel} min`,
        onRemove: () => { setDurationMinutesMin(null); setDurationMinutesMax(null); },
      });
    }

    // Entry time intervals
    const validEntry = entryTimeIntervals.filter(i => i.min && i.max);
    if (validEntry.length > 0) {
      result.push({
        id: 'entry-time', label: 'Entry time',
        value: validEntry.map(i => `${i.min}–${i.max}`).join(', '),
        onRemove: () => setEntryTimeIntervals([]),
      });
    }
    // Exit time intervals
    const validExit = exitTimeIntervals.filter(i => i.min && i.max);
    if (validExit.length > 0) {
      result.push({
        id: 'exit-time', label: 'Exit time',
        value: validExit.map(i => `${i.min}–${i.max}`).join(', '),
        onRemove: () => setExitTimeIntervals([]),
      });
    }

    // Tags by category
    Object.entries(selectedTagsByCategory).forEach(([categoryId, tagIds]) => {
      const categoryName = categories.find(c => c.id === categoryId)?.name || 'Tag';
      tagIds.forEach(tagId => {
        const tagName = tags.find(t => t.id === tagId)?.name || tagId;
        result.push({
          id: `tag-${categoryId}-${tagId}`, label: categoryName, value: tagName,
          onRemove: () => {
            const remaining = tagIds.filter(id => id !== tagId);
            if (remaining.length === 0) {
              const { [categoryId]: _, ...rest } = selectedTagsByCategory;
              setSelectedTagsByCategory(rest);
            } else {
              setSelectedTagsByCategory({ ...selectedTagsByCategory, [categoryId]: remaining });
            }
          },
        });
      });
    });

    // Trade comments
    (['entryComments', 'tradeManagements', 'exitComments'] as const).forEach(category => {
      const labelMap = { entryComments: 'Entry Comment', tradeManagements: 'Trade Mgmt', exitComments: 'Exit Comment' };
      selectedTradeComments[category].forEach(comment => {
        result.push({
          id: `comment-${category}-${comment}`, label: labelMap[category], value: comment,
          onRemove: () => {
            setSelectedTradeComments({
              ...selectedTradeComments,
              [category]: selectedTradeComments[category].filter(c => c !== comment),
            });
          },
        });
      });
    });

    return result;
  }, [
    datePreset, selectedAccounts, selectedSymbols, selectedSetups, excludedSetups, selectedChecklistItems, excludedChecklistItems,
    selectedOutcomes, selectedDirections, selectedYear, selectedDays, selectedHours,
    lastTradesFilter, selectedReturnRanges, rMultipleMin, rMultipleMax,
    positionSizeMin, positionSizeMax,
    holdingPeriodFilter,
    durationMinutesMin, durationMinutesMax,
    entryTimeIntervals, exitTimeIntervals,
    selectedTagsByCategory, selectedTradeComments, strategies, categories, tags,
  ]);

  const clearAll = () => {
    applyDatePreset('all');
    setSelectedAccounts([]);
    setSelectedSymbols([]);
    setSelectedOutcomes([]);
    setSelectedHours([]);
    setSelectedSetups([]);
    setExcludedSetups([]);
    setSelectedDays([]);
    setLastTradesFilter(null);
    setSelectedDirections([]);
    setSelectedReturnRanges([]);
    setRMultipleMin(null);
    setRMultipleMax(null);
    setPositionSizeMin(null);
    setPositionSizeMax(null);
    setHoldingPeriodFilter('all');
    setDurationMinutesMin(null);
    setDurationMinutesMax(null);
    setEntryTimeIntervals([]);
    setExitTimeIntervals([]);
    setSelectedYear(null);
    setSelectedChecklistItems([]);
    setExcludedChecklistItems([]);
    setSelectedTagsByCategory({});
    setSelectedTradeComments({ entryComments: [], tradeManagements: [], exitComments: [] });
  };

  if (isToolsRoute) return null;
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 md:px-8 py-2 border-b border-border bg-card/30 flex-wrap overflow-hidden">
      <span className="text-xs font-medium text-muted-foreground shrink-0">Selected Filters:</span>
      {chips.map((chip) => (
        <Badge
          key={chip.id}
          variant="secondary"
          className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal cursor-default"
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          <span>{chip.value}</span>
          <button
            onClick={chip.onRemove}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-destructive hover:text-destructive gap-1 shrink-0"
        onClick={clearAll}
      >
        <Trash2 className="w-3 h-3" />
        Clear all
      </Button>
    </div>
  );
};
