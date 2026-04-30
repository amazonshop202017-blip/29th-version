import { useState, useRef } from 'react';
import { X, ChevronDown, Check, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Category } from '@/contexts/CategoriesContext';
import { Tag } from '@/contexts/TagsContext';
import { cn } from '@/lib/utils';

interface CategoryTagFieldProps {
  category: Category;
  tags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string, categoryId: string) => void;
  /** When true, renders compact inline label + control (used inside TradeModal). Defaults to boxed card style for AssignTagsModal. */
  compact?: boolean;
}

export const CategoryTagField = ({
  category,
  tags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
  compact = false,
}: CategoryTagFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const categoryTags = tags.filter((t) => t.categoryId === category.id);
  const selectedCategoryTags = categoryTags.filter((t) => selectedTagIds.includes(t.id));

  const filteredTags = categoryTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showCreateOption =
    searchValue.trim() &&
    !categoryTags.some((t) => t.name.toLowerCase() === searchValue.trim().toLowerCase());

  const handleCreateTag = () => {
    if (searchValue.trim()) {
      onCreateTag(searchValue.trim(), category.id);
      setSearchValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showCreateOption) {
      e.preventDefault();
      handleCreateTag();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const containerClass = compact
    ? 'space-y-2'
    : 'bg-muted/30 rounded-lg p-4 space-y-3';

  return (
    <div className={containerClass}>
      {/* Category Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span className={cn('font-medium', compact ? 'text-xs text-muted-foreground' : 'text-sm')}>
          {category.name}
        </span>
      </div>

      {/* Selected Tags Pills */}
      {selectedCategoryTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategoryTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-background border border-border hover:bg-muted/50 transition-colors"
            >
              <span>{tag.name}</span>
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Tag Selection Dropdown */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between h-10 bg-input border-border font-normal"
          >
            <span className="text-muted-foreground text-sm">Select tag</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border-border z-50"
          align="start"
        >
          <div className="p-2 border-b border-border">
            <Input
              ref={inputRef}
              placeholder="Search or create tag..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 bg-input border-border"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-2 space-y-1">
            {filteredTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <div
                  key={tag.id}
                  onClick={() => onToggleTag(tag.id)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                    isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                >
                  <div className="w-4 h-4 rounded border border-border flex items-center justify-center">
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span className="text-sm">{tag.name}</span>
                </div>
              );
            })}

            {showCreateOption && (
              <div
                onClick={handleCreateTag}
                className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 text-primary"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Create "{searchValue.trim()}"</span>
              </div>
            )}

            {filteredTags.length === 0 && !showCreateOption && (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No tags found
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};