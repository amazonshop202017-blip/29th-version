import { useState, useMemo } from 'react';
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

export const AdvancedFiltersPanel = () => {
  const [activeSection, setActiveSection] = useState<MenuSection>('basic');
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
  const {
    selectedTagsByCategory,
    toggleCategoryTagFilter,
    selectAllTagsInCategory,
    clearCategoryTags,
  } = useGlobalFilters();

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
    iconBg: string;
    iconColor: string;
  }[] = [
    {
      key: 'basic',
      label: 'Basic Filters',
      icon: <Filter className="w-3.5 h-3.5" />,
      iconBg: 'bg-violet-100 dark:bg-violet-500/20',
      iconColor: 'text-violet-600 dark:text-violet-300',
    },
    {
      key: 'tags',
      label: 'Tags',
      icon: <Tag className="w-3.5 h-3.5" />,
      iconBg: 'bg-pink-100 dark:bg-pink-500/20',
      iconColor: 'text-pink-600 dark:text-pink-300',
    },
    {
      key: 'daytime',
      label: 'Day & Time',
      icon: <Clock className="w-3.5 h-3.5" />,
      iconBg: 'bg-indigo-100 dark:bg-indigo-500/20',
      iconColor: 'text-indigo-600 dark:text-indigo-300',
    },
    {
      key: 'strategy',
      label: 'Strategy',
      icon: <BarChart2 className="w-3.5 h-3.5" />,
      iconBg: 'bg-amber-100 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-300',
    },
  ];

  return (
    <div className="flex h-[336px] w-[537px]">
      {/* Left Menu */}
      <div className="w-[179px] shrink-0 border-r border-border p-2 flex flex-col gap-2">
        {menuItems.map((item) => {
          const isActive = activeSection === item.key;
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
              <span className={cn("flex items-center justify-center w-7 h-7 rounded-lg shrink-0", item.iconBg, item.iconColor)}>
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
      <div className="flex-1 p-4 w-[358px] overflow-y-auto">
        {activeSection === 'basic' && (
          <AdvancedBasicFiltersSection />
        )}

        {activeSection === 'strategy' && (
          <AdvancedStrategySection />
        )}

        {activeSection === 'daytime' && (
          <AdvancedDayTimeSection />
        )}

        {activeSection === 'tags' && (
          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories created yet. Create categories in Settings → Custom Tags.
              </p>
            ) : (
              categories.map((category) => {
                const categoryTags = tagsByCategory[category.id] || [];
                const isExpanded = expandedCategories.has(category.id) || isCategoryChecked(category.id);
                const isSelectAllMode = isCategorySelectAllMode(category.id);
                
                return (
                  <div key={category.id} className="space-y-2">
                    {/* Category Row */}
                    <div 
                      className="flex items-center gap-3 cursor-pointer select-none py-1.5"
                      onClick={() => handleCategoryCheckToggle(category.id)}
                    >
                      <Checkbox 
                        className="rounded-[4px] h-3.5 w-3.5 [&_svg]:h-3 [&_svg]:w-3"
                        checked={isCategoryChecked(category.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => handleCategoryCheckToggle(category.id)}
                      />
                      <span className="text-sm">{category.name}</span>
                    </div>

                    {/* Expanded Tag Selector */}
                    {isExpanded && categoryTags.length > 0 && (
                      <div className="ml-6 space-y-2">
                        <Popover 
                          open={openPopovers[category.id] || false}
                          onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [category.id]: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between h-9 text-sm bg-background border-border"
                            >
                              {getSelectedTagsLabel(category.id)}
                              <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[220px] p-0 bg-popover border-border z-[100]" align="start">
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
                                      "flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-primary",
                                      isSelectAllMode
                                        ? "bg-primary text-primary-foreground"
                                        : "opacity-50"
                                    )}>
                                      {isSelectAllMode && (
                                        <Check className="h-3 w-3" />
                                      )}
                                    </div>
                                    <span className="font-medium">Select All</span>
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
                                        "flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-primary",
                                        isTagVisuallySelected(category.id, tag.id)
                                          ? "bg-primary text-primary-foreground"
                                          : "opacity-50"
                                      )}>
                                        {isTagVisuallySelected(category.id, tag.id) && (
                                          <Check className="h-3 w-3" />
                                        )}
                                      </div>
                                      <span>{tag.name}</span>
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
                      <p className="ml-6 text-xs text-muted-foreground">
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
  );
};