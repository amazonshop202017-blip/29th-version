import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useCategoriesContext } from './CategoriesContext';

export interface Tag {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  archived?: boolean;
}

interface TagsContextType {
  tags: Tag[];
  addTag: (name: string, categoryId: string, description: string) => Tag | null;
  removeTag: (id: string) => void;
  updateTag: (id: string, name: string, categoryId: string, description: string) => void;
  removeTagsByCategory: (categoryId: string) => void;
  getTagUsageCount: (tagId: string, trades: { tags: string[] }[]) => number;
  archiveTag: (id: string) => void;
  unarchiveTag: (id: string) => void;
  deleteTagPermanently: (id: string) => void;
  getActiveTags: () => Tag[];
  getArchivedTags: () => Tag[];
  /**
   * Bulk reconcile tags for import flows. For each (categoryId, tagName)
   * pair, find an existing tag in that category by case-insensitive name or
   * create one. Single state write, returns a lookup map keyed by
   * `${categoryId}::${nameLower}`.
   */
  reconcileTagsForImport: (
    inputs: { categoryId: string; name: string }[],
  ) => {
    map: Map<string, Tag>;
    tagsCreated: number;
  };
}

const TagsContext = createContext<TagsContextType | undefined>(undefined);

const TAGS_STORAGE_KEY = 'trading-journal-tags-v2';

const generateId = () => `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const TagsProvider = ({ children }: { children: ReactNode }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const { onCategoryRemove } = useCategoriesContext();

  useEffect(() => {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (stored) {
      setTags(JSON.parse(stored));
    }
  }, []);

  const saveTags = useCallback((newTags: Tag[]) => {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(newTags));
    setTags(newTags);
  }, []);

  const removeTagsByCategory = useCallback((categoryId: string) => {
    setTags(currentTags => {
      const newTags = currentTags.filter(t => t.categoryId !== categoryId);
      localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(newTags));
      return newTags;
    });
  }, []);

  // Subscribe to category removal events
  useEffect(() => {
    const unsubscribe = onCategoryRemove((categoryId) => {
      removeTagsByCategory(categoryId);
    });
    return unsubscribe;
  }, [onCategoryRemove, removeTagsByCategory]);

  const addTag = useCallback((name: string, categoryId: string, description: string): Tag | null => {
    const trimmed = name.trim();
    if (trimmed && categoryId) {
      const newTag: Tag = {
        id: generateId(),
        name: trimmed,
        categoryId,
        description: description.trim(),
        archived: false,
      };
      saveTags([...tags, newTag]);
      return newTag;
    }
    return null;
  }, [tags, saveTags]);

  const removeTag = useCallback((id: string) => {
    saveTags(tags.filter(t => t.id !== id));
  }, [tags, saveTags]);

  const updateTag = useCallback((id: string, name: string, categoryId: string, description: string) => {
    const trimmed = name.trim();
    if (trimmed && categoryId) {
      saveTags(tags.map(t => 
        t.id === id ? { ...t, name: trimmed, categoryId, description: description.trim() } : t
      ));
    }
  }, [tags, saveTags]);

  const archiveTag = useCallback((id: string) => {
    saveTags(tags.map(t => 
      t.id === id ? { ...t, archived: true } : t
    ));
  }, [tags, saveTags]);

  const unarchiveTag = useCallback((id: string) => {
    saveTags(tags.map(t => 
      t.id === id ? { ...t, archived: false } : t
    ));
  }, [tags, saveTags]);

  const deleteTagPermanently = useCallback((id: string) => {
    saveTags(tags.filter(t => t.id !== id));
  }, [tags, saveTags]);

  const getActiveTags = useCallback(() => {
    return tags.filter(t => !t.archived);
  }, [tags]);

  const getArchivedTags = useCallback(() => {
    return tags.filter(t => t.archived);
  }, [tags]);

  const getTagUsageCount = useCallback((tagId: string, trades: { tags: string[] }[]) => {
    return trades.filter(trade => trade.tags?.includes(tagId)).length;
  }, []);

  const reconcileTagsForImport = useCallback((
    inputs: { categoryId: string; name: string }[],
  ) => {
    const map = new Map<string, Tag>();
    let tagsCreated = 0;

    const next = [...tags];
    const keyOf = (categoryId: string, name: string) =>
      `${categoryId}::${name.trim().toLowerCase()}`;
    for (const t of next) {
      map.set(keyOf(t.categoryId, t.name), t);
    }

    for (const input of inputs) {
      const trimmed = input.name.trim();
      if (!trimmed || !input.categoryId) continue;
      const key = keyOf(input.categoryId, trimmed);
      if (map.has(key)) continue;
      const created: Tag = {
        id: generateId(),
        name: trimmed,
        categoryId: input.categoryId,
        description: '',
        archived: false,
      };
      next.push(created);
      map.set(key, created);
      tagsCreated++;
    }

    if (tagsCreated > 0) {
      saveTags(next);
    }

    return { map, tagsCreated };
  }, [tags, saveTags]);

  return (
    <TagsContext.Provider value={{ 
      tags, 
      addTag, 
      removeTag, 
      updateTag, 
      removeTagsByCategory,
      getTagUsageCount,
      archiveTag,
      unarchiveTag,
      deleteTagPermanently,
      getActiveTags,
      getArchivedTags,
      reconcileTagsForImport,
    }}>
      {children}
    </TagsContext.Provider>
  );
};

export const useTagsContext = () => {
  const context = useContext(TagsContext);
  if (!context) {
    throw new Error('useTagsContext must be used within TagsProvider');
  }
  return context;
};
