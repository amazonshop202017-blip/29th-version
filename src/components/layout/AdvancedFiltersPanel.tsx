import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Tag, ChevronDown, ChevronRight, Check, Filter, Clock, BarChart2 } from 'lucide-react';
import { AdvancedBasicFiltersSection } from './AdvancedBasicFiltersSection';
import { AdvancedDayTimeSection } from './AdvancedDayTimeSection';
import { AdvancedStrategySection } from './AdvancedStrategySection';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useGlobalFilters, TradeCommentCategory } from '@/contexts/GlobalFiltersContext';
import { useCategoriesContext } from '@/contexts/CategoriesContext';
import { useTagsContext } from '@/contexts/TagsContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

type MenuSection = 'basic' | 'strategy' | 'daytime' | 'tags';

interface AdvancedFiltersPanelProps {
  onClose?: () => void;
}

export const AdvancedFiltersPanel = ({ onClose }: AdvancedFiltersPanelProps = {}) => {
  const [activeSection, setActiveSection] = useState<MenuSection | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const [expandedCommentCategories, setExpandedCommentCategories] = useState<Set<TradeCommentCategory>>(new Set());
  const [openCommentPopovers, setOpenCommentPopovers] = useState<Record<TradeCommentCategory, boolean>>({
    entryComments: false,
    tradeManagements: false,
    exitComments: false,
  });
  
  const { categories } = useCategoriesContext();
  const { getActiveTags } = useTagsContext();
  const filters = useGlobalFilters();
  const {
    selectedTagsByCategory,
    toggleCategoryTagFilter,
    selectAllTagsInCategory,
    clearCategoryTags,
    freezeAppliedFilters,
    commitAppliedFilters,
    unfreezeAppliedFilters,
  } = filters;

  // Snapshot of all popup-relevant filter values on mount; Cancel restores them.
  const captureSnapshot = useCallback(() => ({
    selectedSymbols: filters.selectedSymbols,
    selectedOutcomes: filters.selectedOutcomes,
    selectedHours: filters.selectedHours,
    selectedSetups: filters.selectedSetups,
    excludedSetups: filters.excludedSetups,
    selectedDays: filters.selectedDays,
    lastTradesFilter: filters.lastTradesFilter,
    selectedDirections: filters.selectedDirections,
    selectedReturnRanges: filters.selectedReturnRanges,
    rMultipleMin: filters.rMultipleMin,
    rMultipleMax: filters.rMultipleMax,
    positionSizeMin: filters.positionSizeMin,
    positionSizeMax: filters.positionSizeMax,
    holdingPeriodFilter: filters.holdingPeriodFilter,
    durationMinutesMin: filters.durationMinutesMin,
    durationMinutesMax: filters.durationMinutesMax,
    entryTimeIntervals: filters.entryTimeIntervals,
    exitTimeIntervals: filters.exitTimeIntervals,
    starredFilter: filters.starredFilter,
    selectedYear: filters.selectedYear,
    selectedChecklistItems: filters.selectedChecklistItems,
    excludedChecklistItems: filters.excludedChecklistItems,
    selectedTagsByCategory: filters.selectedTagsByCategory,
    selectedTradeComments: filters.selectedTradeComments,
  }), [filters]);

  const snapshotRef = useRef<ReturnType<typeof captureSnapshot> | null>(null);
  const appliedRef = useRef(false);
  // Capture once on mount (popup open)
  useEffect(() => {
    if (snapshotRef.current === null) {
      snapshotRef.current = captureSnapshot();
      // Freeze applied-filter values used by analytics so edits in this
      // popup do not affect charts/tables until Apply is clicked.
      freezeAppliedFilters();
    }
    return () => {
      // On unmount (popup closed without Apply), revert pending changes.
      if (!appliedRef.current && snapshotRef.current) {
        restoreSnapshotFromRef(snapshotRef.current);
        unfreezeAppliedFilters();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable restore that reads from a passed snapshot (used in cleanup where filters ref may be stale)
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const restoreSnapshotFromRef = useCallback((s: ReturnType<typeof captureSnapshot>) => {
    const f = filtersRef.current;
    f.setSelectedSymbols(s.selectedSymbols);
    f.setSelectedOutcomes(s.selectedOutcomes);
    f.setSelectedHours(s.selectedHours);
    f.setSelectedSetups(s.selectedSetups);
    f.setExcludedSetups(s.excludedSetups);
    f.setSelectedDays(s.selectedDays);
    f.setLastTradesFilter(s.lastTradesFilter);
    f.setSelectedDirections(s.selectedDirections);
    f.setSelectedReturnRanges(s.selectedReturnRanges);
    f.setRMultipleMin(s.rMultipleMin);
    f.setRMultipleMax(s.rMultipleMax);
    f.setPositionSizeMin(s.positionSizeMin);
    f.setPositionSizeMax(s.positionSizeMax);
    f.setHoldingPeriodFilter(s.holdingPeriodFilter);
    f.setDurationMinutesMin(s.durationMinutesMin);
    f.setDurationMinutesMax(s.durationMinutesMax);
    f.setEntryTimeIntervals(s.entryTimeIntervals);
    f.setExitTimeIntervals(s.exitTimeIntervals);
    f.setStarredFilter(s.starredFilter);
    f.setSelectedYear(s.selectedYear);
    f.setSelectedChecklistItems(s.selectedChecklistItems);
    f.setExcludedChecklistItems(s.excludedChecklistItems);
    f.setSelectedTagsByCategory(s.selectedTagsByCategory);
    f.setSelectedTradeComments(s.selectedTradeComments);
  }, []);

  const resetAll = useCallback(() => {
    filters.setSelectedSymbols([]);
    filters.setSelectedOutcomes([]);
    filters.setSelectedHours([]);
    filters.setSelectedSetups([]);
    filters.setExcludedSetups([]);
    filters.setSelectedDays([]);
    filters.setLastTradesFilter(null);
    filters.setSelectedDirections([]);
    filters.setSelectedReturnRanges([]);
    filters.setRMultipleMin(null);
    filters.setRMultipleMax(null);
    filters.setPositionSizeMin(null);
    filters.setPositionSizeMax(null);
    filters.setHoldingPeriodFilter('all');
    filters.setDurationMinutesMin(null);
    filters.setDurationMinutesMax(null);
    filters.setEntryTimeIntervals([]);
    filters.setExitTimeIntervals([]);
    filters.setStarredFilter('all');
    filters.setSelectedYear(null);
    filters.setSelectedChecklistItems([]);
    filters.setExcludedChecklistItems([]);
    filters.setSelectedTagsByCategory({});
    filters.setSelectedTradeComments({ entryComments: [], tradeManagements: [], exitComments: [] });
  }, [filters]);

  const handleCancel = () => {
    if (snapshotRef.current) restoreSnapshotFromRef(snapshotRef.current);
    unfreezeAppliedFilters();
    appliedRef.current = true; // prevent double-restore on unmount
    onClose?.();
  };
  const handleApply = () => {
    // Update snapshot baseline so re-opening does not revert applied changes
    snapshotRef.current = captureSnapshot();
    commitAppliedFilters();
    appliedRef.current = true;
    onClose?.();
  };

  // Get active (non-archived) tags only
  const activeTags = useMemo(() => getActiveTags(), [getActiveTags]);

  // Get tags grouped by category (only active tags)
  const tagsByCategory = useMemo(() => {
    const grouped: Record<string, typeof activeTags> = {};
    categories.forEach(category => {
      grouped[category.id] = activeTags.filter(tag => tag.categoryId === category.id);
    });
    return grouped;
  }, [categories, activeTags]);

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const isCategoryChecked = (categoryId: string) => {
    return (selectedTagsByCategory[categoryId]?.length || 0) > 0;
  };

  // Check if category is in "Select All" mode (all tags are selected)
  const isCategorySelectAllMode = (categoryId: string) => {
    const categoryTags = tagsByCategory[categoryId] || [];
    const selectedTags = selectedTagsByCategory[categoryId] || [];
    return categoryTags.length > 0 && selectedTags.length === categoryTags.length;
  };

  const handleCategoryCheckToggle = (categoryId: string) => {
    if (isCategoryChecked(categoryId)) {
      clearCategoryTags(categoryId);
      setExpandedCategories(prev => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    } else {
      // When checking, auto-select ALL tags and expand the category
      const categoryTags = tagsByCategory[categoryId] || [];
      const allTagIds = categoryTags.map(t => t.id);
      selectAllTagsInCategory(categoryId, allTagIds);
      setExpandedCategories(prev => new Set([...prev, categoryId]));
    }
  };

  const handleSelectAllTags = (categoryId: string) => {
    const categoryTags = tagsByCategory[categoryId] || [];
    const allTagIds = categoryTags.map(t => t.id);
    selectAllTagsInCategory(categoryId, allTagIds);
  };

  const handleTagClick = (categoryId: string, tagId: string) => {
    const categoryTags = tagsByCategory[categoryId] || [];
    const isSelectAll = isCategorySelectAllMode(categoryId);
    
    if (isSelectAll) {
      // Transitioning from "Select All" to individual selection
      // Clear all and select only the clicked item
      selectAllTagsInCategory(categoryId, [tagId]);
    } else {
      // Normal toggle behavior
      toggleCategoryTagFilter(categoryId, tagId);
    }
  };

  // Visual check: in "Select All" mode, individual items appear unchecked
  const isTagVisuallySelected = (categoryId: string, tagId: string) => {
    if (isCategorySelectAllMode(categoryId)) {
      return false; // In "Select All" mode, individual items are not visually checked
    }
    return selectedTagsByCategory[categoryId]?.includes(tagId) || false;
  };

  const getSelectedTagsLabel = (categoryId: string) => {
    const selectedCount = selectedTagsByCategory[categoryId]?.length || 0;
    const categoryTags = tagsByCategory[categoryId] || [];
    if (selectedCount === 0) return 'Select tags';
    if (selectedCount === categoryTags.length) return 'All selected';
    return `${selectedCount} selected`;
  };

  const menuItems: {
    key: MenuSection;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'basic',
      label: 'Basic Filters',
      icon: <Filter className="w-3.5 h-3.5" />,
    },
    {
      key: 'tags',
      label: 'Tags',
      icon: <Tag className="w-3.5 h-3.5" />,
    },
    {
      key: 'daytime',
      label: 'Day & Time',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      key: 'strategy',
      label: 'Strategy',
      icon: <BarChart2 className="w-3.5 h-3.5" />,
    },
  ];

  const selectedDesktopSection: MenuSection = activeSection ?? 'basic';
  const visibleSection: MenuSection = activeSection ?? 'basic';

  return (
    <div className="flex w-full min-w-0 flex-col overflow-x-hidden lg:w-[537px] lg:max-w-[calc(100vw-2rem)]">
      <div className="flex min-h-[336px] min-w-0 flex-1 overflow-hidden lg:h-[336px]">
      {/* Left Menu */}
      <div className="hidden w-[179px] shrink-0 flex-col gap-2 border-r border-border p-2 lg:flex">
        {menuItems.map((item) => {
          const isActive = selectedDesktopSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all text-left w-full border",
                isActive
                  ? "bg-accent/60 border-border shadow-sm text-foreground"
                  : "bg-card border-border/60 hover:bg-accent/40 text-foreground"
              )}
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-muted text-muted-foreground">
                {item.icon}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              <ChevronRight className={cn(
                "w-3.5 h-3.5 shrink-0 transition-transform text-muted-foreground",
                isActive ? "rotate-0" : "rotate-90"
              )} />
            </button>
          );
        })}
      </div>

      {/* Right Content */}
      <div className="flex-1 min-w-0 w-full p-4 overflow-y-auto overflow-x-hidden lg:w-[358px]">
        <div className="space-y-2 lg:hidden">
          {activeSection === null ? (
            menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className="flex w-full min-w-0 items-center gap-2.5 rounded-md border border-border bg-card px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))
          ) : (
            <button
              onClick={() => setActiveSection(null)}
              className="flex w-full min-w-0 items-center gap-2.5 rounded-md border border-border bg-accent/60 px-2.5 py-2 text-left text-sm font-medium text-foreground"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {menuItems.find((item) => item.key === activeSection)?.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{menuItems.find((item) => item.key === activeSection)?.label}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className={cn("min-w-0 overflow-x-hidden", activeSection === null ? "hidden lg:block" : "mt-4 lg:mt-0")}>
        {visibleSection === 'basic' && (
          <AdvancedBasicFiltersSection />
        )}

        {visibleSection === 'strategy' && (
          <AdvancedStrategySection />
        )}

        {visibleSection === 'daytime' && (
          <AdvancedDayTimeSection />
        )}

        {visibleSection === 'tags' && (
          <div className="space-y-2 min-w-0">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground break-words">
                No categories created yet. Create categories in Settings → Custom Tags.
              </p>
            ) : (
              categories.map((category) => {
                const categoryTags = tagsByCategory[category.id] || [];
                const isExpanded = expandedCategories.has(category.id) || isCategoryChecked(category.id);
                const isSelectAllMode = isCategorySelectAllMode(category.id);
                
                return (
                  <div key={category.id} className="space-y-2 min-w-0">
                    {/* Category Row */}
                    <div 
                      className="flex min-w-0 items-center gap-3 cursor-pointer select-none py-1.5"
                      onClick={() => handleCategoryCheckToggle(category.id)}
                    >
                      <Checkbox 
                        className="rounded-[4px] h-3.5 w-3.5 shrink-0 [&_svg]:h-3 [&_svg]:w-3"
                        checked={isCategoryChecked(category.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => handleCategoryCheckToggle(category.id)}
                      />
                      <span className="min-w-0 truncate text-sm">{category.name}</span>
                    </div>

                    {/* Expanded Tag Selector */}
                    {isExpanded && categoryTags.length > 0 && (
                      <div className="ml-6 min-w-0 space-y-2">
                        <Popover 
                          open={openPopovers[category.id] || false}
                          onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [category.id]: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full min-w-0 justify-between h-9 text-sm bg-background border-border"
                            >
                              <span className="min-w-0 truncate">{getSelectedTagsLabel(category.id)}</span>
                              <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[min(220px,calc(100vw-4rem))] p-0 bg-popover border-border z-[100]" align="start">
                            <Command>
                              <CommandInput placeholder="Search tags..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>No tags found.</CommandEmpty>
                                <CommandGroup>
                                  {/* Select All Option */}
                                  <CommandItem
                                    onSelect={() => handleSelectAllTags(category.id)}
                                    className="cursor-pointer gap-3 py-2"
                                  >
                                    <div className={cn(
                                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-primary",
                                      isSelectAllMode
                                        ? "bg-primary text-primary-foreground"
                                        : "opacity-50"
                                    )}>
                                      {isSelectAllMode && (
                                        <Check className="h-3 w-3" />
                                      )}
                                    </div>
                                    <span className="min-w-0 truncate font-medium">Select All</span>
                                  </CommandItem>
                                </CommandGroup>
                                <CommandSeparator />
                                <CommandGroup>
                                  {categoryTags.map((tag) => (
                                    <CommandItem
                                      key={tag.id}
                                      onSelect={() => handleTagClick(category.id, tag.id)}
                                      className="cursor-pointer gap-3 py-2"
                                    >
                                      <div className={cn(
                                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-primary",
                                        isTagVisuallySelected(category.id, tag.id)
                                          ? "bg-primary text-primary-foreground"
                                          : "opacity-50"
                                      )}>
                                        {isTagVisuallySelected(category.id, tag.id) && (
                                          <Check className="h-3 w-3" />
                                        )}
                                      </div>
                                      <span className="min-w-0 truncate">{tag.name}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                    
                    {isExpanded && categoryTags.length === 0 && (
                      <p className="ml-6 text-xs text-muted-foreground break-words">
                        No tags in this category
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      </div>
      </div>
      {/* Footer */}
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-3 lg:static lg:bg-transparent">
        <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-colors">
          Reset all
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
          <Button size="sm" onClick={handleApply}>Apply filters</Button>
        </div>
      </div>
    </div>
  );
};