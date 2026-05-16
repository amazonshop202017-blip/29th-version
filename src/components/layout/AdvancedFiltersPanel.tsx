import { useState, useMemo } from 'react';
import { Tag, ChevronDown, ChevronRight, Check, Filter, Clock } from 'lucide-react';
import { AdvancedBasicFiltersSection } from './AdvancedBasicFiltersSection';
import { AdvancedDayTimeSection } from './AdvancedDayTimeSection';
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

type MenuSection = 'basic' | 'daytime' | 'tags';

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

  const menuItems: { key: MenuSection; label: string; icon: React.ReactNode }[] = [
    { key: 'basic', label: 'Basic Filters', icon: <Filter className="w-4 h-4" /> },
    { key: 'daytime', label: 'Day & Time', icon: <Clock className="w-4 h-4" /> },
    { key: 'tags', label: 'Tags', icon: <Tag className="w-4 h-4" /> },
  ];

  return (
    <div className="flex min-h-[300px]">
      {/* Left Menu */}
      <div className="w-40 border-r border-border p-2 flex flex-col gap-1">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left w-full",
              activeSection === item.key
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
            )}
          >
            {item.icon}
            {item.label}
            <ChevronRight className={cn(
              "w-3 h-3 ml-auto transition-transform",
              activeSection === item.key && "rotate-0"
            )} />
          </button>
        ))}
      </div>

      {/* Right Content */}
      <div className="flex-1 p-4 min-w-[320px]">
        {activeSection === 'basic' && (
          <AdvancedBasicFiltersSection />
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
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => handleCategoryCheckToggle(category.id)}
                    >
                      <Checkbox 
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
                                    className="cursor-pointer"
                                  >
                                    <div className={cn(
                                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
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
                                      className="cursor-pointer"
                                    >
                                      <div className={cn(
                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
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