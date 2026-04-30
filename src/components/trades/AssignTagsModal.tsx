import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCategoriesContext } from '@/contexts/CategoriesContext';
import { useTagsContext } from '@/contexts/TagsContext';
import { CategoryTagField } from './CategoryTagField';

// Preset colors for new tags (excluding already used ones)
const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#78716c', '#737373', '#71717a',
];

interface AssignTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  symbol?: string;
  entryDate?: string;
}

export const AssignTagsModal = ({
  isOpen,
  onClose,
  selectedTagIds,
  onTagsChange,
  symbol,
  entryDate,
}: AssignTagsModalProps) => {
  const { categories } = useCategoriesContext();
  const { tags, addTag, getActiveTags } = useTagsContext();
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedTagIds);
  
  // Only show active (non-archived) tags in the selection UI
  const activeTags = getActiveTags();

  // Sync local state when modal opens or selectedTagIds changes
  useEffect(() => {
    if (isOpen) {
      setLocalSelectedIds(selectedTagIds);
    }
  }, [isOpen, selectedTagIds]);

  const handleToggleTag = (tagId: string) => {
    setLocalSelectedIds(prev => {
      const newIds = prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId];
      return newIds;
    });
  };

  const handleCreateTag = (name: string, categoryId: string) => {
    // Create tag in the context (will be persisted to localStorage)
    const newTag = addTag(name, categoryId, '');
    
    // Immediately select the newly created tag
    if (newTag) {
      setLocalSelectedIds(prev => [...prev, newTag.id]);
    }
  };

  // Handle close - save changes
  const handleClose = () => {
    onTagsChange(localSelectedIds);
    onClose();
  };

  // Format entry date for display
  const formattedDate = entryDate 
    ? new Date(entryDate).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  const subText = [symbol, formattedDate].filter(Boolean).join(' • ');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">Add and manage tags</DialogTitle>
              {subText && (
                <p className="text-sm text-muted-foreground mt-1">{subText}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No categories found.</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Create categories in Settings → Custom Tags
                </p>
              </div>
            ) : (
              categories.map(category => (
                <CategoryTagField
                  key={category.id}
                  category={category}
                  tags={activeTags}
                  selectedTagIds={localSelectedIds}
                  onToggleTag={handleToggleTag}
                  onCreateTag={handleCreateTag}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
