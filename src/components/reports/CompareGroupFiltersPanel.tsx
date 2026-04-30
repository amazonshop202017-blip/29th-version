import { useState, useMemo } from 'react';
import { Settings, Tag, ChevronDown, ChevronRight, Check, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useCategoriesContext } from '@/contexts/CategoriesContext';
import { useTagsContext } from '@/contexts/TagsContext';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type MenuSection = 'general' | 'tags';
type TradeCommentCategory = 'entryComments' | 'tradeManagements' | 'exitComments';

interface CompareGroupFiltersPanelProps {
  tagsByCategory: Record<string, string[]>;
  tradeComments: Record<TradeCommentCategory, string[]>;
  onTagsChange: (tags: Record<string, string[]>) => void;
  onCommentsChange: (comments: Record<TradeCommentCategory, string[]>) => void;
}

export const CompareGroupFiltersPanel = ({
  tagsByCategory,
  tradeComments,
  onTagsChange,
  onCommentsChange,
}: CompareGroupFiltersPanelProps) => {
  const [activeSection, setActiveSection] = useState<MenuSection>('general');
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

  // Get active (non-archived) tags only
  const activeTags = useMemo(() => getActiveTags(), [getActiveTags]);

  // Get tags grouped by category (only active tags)
  const tagsByCategoryMap = useMemo(() => {
    const grouped: Record<string, typeof activeTags> = {};
    categories.forEach(category => {
      grouped[category.id] = activeTags.filter(tag => tag.categoryId === category.id);
    });
    return grouped;
  }, [categories, activeTags]);

  // Get active comment options
  const activeEntryComments: string[] = useMemo(() => [], []);
  const activeTradeManagements: string[] = useMemo(() => [], []);
  const activeExitComments: string[] = useMemo(() => [], []);

  const commentCategories: { key: TradeCommentCategory; label: string; comments: string[] }[] = [
    { key: 'entryComments', label: 'Entry Comments', comments: activeEntryComments },
    { key: 'tradeManagements', label: 'Trade Management', comments: activeTradeManagements },
    { key: 'exitComments', label: 'Exit Comments', comments: activeExitComments },
  ];

  // Tag handlers
  const isCategoryChecked = (categoryId: string) => {
    return (tagsByCategory[categoryId]?.length || 0) > 0;
  };

  const isCategorySelectAllMode = (categoryId: string) => {
    const categoryTags = tagsByCategoryMap[categoryId] || [];
    const selectedTags = tagsByCategory[categoryId] || [];
    return categoryTags.length > 0 && selectedTags.length === categoryTags.length;
  };

  const handleCategoryCheckToggle = (categoryId: string) => {
    if (isCategoryChecked(categoryId)) {
      const newTags = { ...tagsByCategory };
      delete newTags[categoryId];
      onTagsChange(newTags);
      setExpandedCategories(prev => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    } else {
      const categoryTags = tagsByCategoryMap[categoryId] || [];
      const allTagIds = categoryTags.map(t => t.id);
      onTagsChange({ ...tagsByCategory, [categoryId]: allTagIds });
      setExpandedCategories(prev => new Set([...prev, categoryId]));
    }
  };

  const handleSelectAllTags = (categoryId: string) => {
    const categoryTags = tagsByCategoryMap[categoryId] || [];
    const allTagIds = categoryTags.map(t => t.id);
    onTagsChange({ ...tagsByCategory, [categoryId]: allTagIds });
  };

  const handleTagClick = (categoryId: string, tagId: string) => {
    const isSelectAll = isCategorySelectAllMode(categoryId);
    if (isSelectAll) {
      onTagsChange({ ...tagsByCategory, [categoryId]: [tagId] });
    } else {
      const current = tagsByCategory[categoryId] || [];
      const isSelected = current.includes(tagId);
      const updated = isSelected
        ? current.filter(id => id !== tagId)
        : [...current, tagId];
      
      if (updated.length === 0) {
        const newTags = { ...tagsByCategory };
        delete newTags[categoryId];
        onTagsChange(newTags);
      } else {
        onTagsChange({ ...tagsByCategory, [categoryId]: updated });
      }
    }
  };

  const isTagVisuallySelected = (categoryId: string, tagId: string) => {
    if (isCategorySelectAllMode(categoryId)) {
      return false;
    }
    return tagsByCategory[categoryId]?.includes(tagId) || false;
  };

  const getSelectedTagsLabel = (categoryId: string) => {
    const selectedCount = tagsByCategory[categoryId]?.length || 0;
    const categoryTags = tagsByCategoryMap[categoryId] || [];
    if (selectedCount === 0) return 'Select tags';
    if (selectedCount === categoryTags.length) return 'All selected';
    return `${selectedCount} selected`;
  };

  // Comment handlers
  const isCommentCategoryChecked = (category: TradeCommentCategory) => {
    return tradeComments[category].length > 0;
  };

  const isCommentCategorySelectAllMode = (category: TradeCommentCategory, allComments: string[]) => {
    const selectedComments = tradeComments[category];
    return allComments.length > 0 && selectedComments.length === allComments.length;
  };

  const handleCommentCategoryCheckToggle = (category: TradeCommentCategory, allComments: string[]) => {
    if (isCommentCategoryChecked(category)) {
      onCommentsChange({ ...tradeComments, [category]: [] });
      setExpandedCommentCategories(prev => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    } else {
      onCommentsChange({ ...tradeComments, [category]: allComments });
      setExpandedCommentCategories(prev => new Set([...prev, category]));
    }
  };

  const handleSelectAllComments = (category: TradeCommentCategory, comments: string[]) => {
    onCommentsChange({ ...tradeComments, [category]: comments });
  };

  const handleCommentClick = (category: TradeCommentCategory, comment: string, allComments: string[]) => {
    const isSelectAll = isCommentCategorySelectAllMode(category, allComments);
    if (isSelectAll) {
      onCommentsChange({ ...tradeComments, [category]: [comment] });
    } else {
      const current = tradeComments[category];
      const isSelected = current.includes(comment);
      const updated = isSelected
        ? current.filter(c => c !== comment)
        : [...current, comment];
      onCommentsChange({ ...tradeComments, [category]: updated });
    }
  };

  const isCommentVisuallySelected = (category: TradeCommentCategory, comment: string, allComments: string[]) => {
    if (isCommentCategorySelectAllMode(category, allComments)) {
      return false;
    }
    return tradeComments[category].includes(comment);
  };

  const getSelectedCommentsLabel = (category: TradeCommentCategory, allComments: string[]) => {
    const selectedCount = tradeComments[category].length;
    if (selectedCount === 0) return 'Select comments';
    if (selectedCount === allComments.length) return 'All selected';
    return `${selectedCount} selected`;
  };

  const menuItems: { key: MenuSection; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { key: 'tags', label: 'Tags', icon: <Tag className="w-4 h-4" /> },
  ];

  return (
    <div className="flex min-h-[300px]">
      {/* Left Menu */}
      <div className="w-32 border-r border-border p-2 flex flex-col gap-1">
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
      <div className="flex-1 p-4 min-w-[250px]">
        {activeSection === 'general' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Trade Comments
              </h4>
              <div className="space-y-2">
                {commentCategories.map(({ key, label, comments }) => {
                  const isExpanded = expandedCommentCategories.has(key) || isCommentCategoryChecked(key);
                  const isSelectAllMode = isCommentCategorySelectAllMode(key, comments);

                  return (
                    <div key={key} className="space-y-2">
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => handleCommentCategoryCheckToggle(key, comments)}
                      >
                        <Checkbox
                          checked={isCommentCategoryChecked(key)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => handleCommentCategoryCheckToggle(key, comments)}
                        />
                        <span className="text-sm">{label}</span>
                      </div>

                      {isExpanded && comments.length > 0 && (
                        <div className="ml-6 space-y-2">
                          <Popover
                            open={openCommentPopovers[key] || false}
                            onOpenChange={(open) => setOpenCommentPopovers(prev => ({ ...prev, [key]: open }))}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between h-9 text-sm bg-background border-border"
                              >
                                {getSelectedCommentsLabel(key, comments)}
                                <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0 bg-popover border-border z-[150]" align="start">
                              <Command>
                                <CommandInput placeholder="Search..." className="h-9" />
                                <CommandList>
                                  <CommandEmpty>No comments found.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      onSelect={() => handleSelectAllComments(key, comments)}
                                      className="cursor-pointer"
                                    >
                                      <div className={cn(
                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                        isSelectAllMode ? "bg-primary text-primary-foreground" : "opacity-50"
                                      )}>
                                        {isSelectAllMode && <Check className="h-3 w-3" />}
                                      </div>
                                      <span className="font-medium">Select All</span>
                                    </CommandItem>
                                  </CommandGroup>
                                  <CommandSeparator />
                                  <CommandGroup>
                                    {comments.map((comment) => (
                                      <CommandItem
                                        key={comment}
                                        onSelect={() => handleCommentClick(key, comment, comments)}
                                        className="cursor-pointer"
                                      >
                                        <div className={cn(
                                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                          isCommentVisuallySelected(key, comment, comments)
                                            ? "bg-primary text-primary-foreground"
                                            : "opacity-50"
                                        )}>
                                          {isCommentVisuallySelected(key, comment, comments) && <Check className="h-3 w-3" />}
                                        </div>
                                        <span>{comment}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}

                      {isExpanded && comments.length === 0 && (
                        <p className="ml-6 text-xs text-muted-foreground">
                          No comments available
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'tags' && (
          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories created yet.
              </p>
            ) : (
              categories.map((category) => {
                const categoryTags = tagsByCategoryMap[category.id] || [];
                const isExpanded = expandedCategories.has(category.id) || isCategoryChecked(category.id);
                const isSelectAllMode = isCategorySelectAllMode(category.id);

                return (
                  <div key={category.id} className="space-y-2">
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
                          <PopoverContent className="w-[200px] p-0 bg-popover border-border z-[150]" align="start">
                            <Command>
                              <CommandInput placeholder="Search tags..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>No tags found.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => handleSelectAllTags(category.id)}
                                    className="cursor-pointer"
                                  >
                                    <div className={cn(
                                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                      isSelectAllMode ? "bg-primary text-primary-foreground" : "opacity-50"
                                    )}>
                                      {isSelectAllMode && <Check className="h-3 w-3" />}
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
                                        {isTagVisuallySelected(category.id, tag.id) && <Check className="h-3 w-3" />}
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
