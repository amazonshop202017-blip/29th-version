import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

export interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoriesContextType {
  categories: Category[];
  addCategory: (name: string, color: string) => void;
  removeCategory: (id: string) => void;
  updateCategory: (id: string, name: string, color: string) => void;
  onCategoryRemove: (callback: (categoryId: string) => void) => () => void;
  /**
   * Bulk reconcile categories for import flows. Creates any missing
   * categories (assigning colors from a default palette) in a single state
   * write, returning a name→Category lookup map.
   */
  reconcileCategoriesForImport: (names: string[]) => {
    map: Map<string, Category>;
    categoriesCreated: number;
  };
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

const CATEGORIES_STORAGE_KEY = 'trading-journal-categories';

const generateId = () => `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const DEFAULT_CATEGORY_PALETTE = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const removeCallbacksRef = useRef<Set<(categoryId: string) => void>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (stored) {
      setCategories(JSON.parse(stored));
    }
  }, []);

  const saveCategories = useCallback((newCategories: Category[]) => {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(newCategories));
    setCategories(newCategories);
  }, []);

  const addCategory = useCallback((name: string, color: string) => {
    const trimmed = name.trim();
    if (trimmed && !categories.some(c => c.name === trimmed)) {
      const newCategory: Category = {
        id: generateId(),
        name: trimmed,
        color,
      };
      saveCategories([...categories, newCategory]);
    }
  }, [categories, saveCategories]);

  const removeCategory = useCallback((id: string) => {
    // Notify subscribers before removing
    removeCallbacksRef.current.forEach(callback => callback(id));
    saveCategories(categories.filter(c => c.id !== id));
  }, [categories, saveCategories]);

  const updateCategory = useCallback((id: string, name: string, color: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      saveCategories(categories.map(c => 
        c.id === id ? { ...c, name: trimmed, color } : c
      ));
    }
  }, [categories, saveCategories]);

  const onCategoryRemove = useCallback((callback: (categoryId: string) => void) => {
    removeCallbacksRef.current.add(callback);
    return () => {
      removeCallbacksRef.current.delete(callback);
    };
  }, []);

  const reconcileCategoriesForImport = useCallback((names: string[]) => {
    const map = new Map<string, Category>();
    let categoriesCreated = 0;

    const next = [...categories];
    for (const c of next) {
      map.set(c.name.trim().toLowerCase(), c);
    }

    let paletteIdx = next.length;
    for (const rawName of names) {
      const trimmed = rawName.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (map.has(key)) continue;
      const created: Category = {
        id: generateId(),
        name: trimmed,
        color: DEFAULT_CATEGORY_PALETTE[paletteIdx % DEFAULT_CATEGORY_PALETTE.length],
      };
      next.push(created);
      map.set(key, created);
      paletteIdx++;
      categoriesCreated++;
    }

    if (categoriesCreated > 0) {
      saveCategories(next);
    }

    return { map, categoriesCreated };
  }, [categories, saveCategories]);

  return (
    <CategoriesContext.Provider value={{ categories, addCategory, removeCategory, updateCategory, onCategoryRemove, reconcileCategoriesForImport }}>
      {children}
    </CategoriesContext.Provider>
  );
};

export const useCategoriesContext = () => {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error('useCategoriesContext must be used within CategoriesProvider');
  }
  return context;
};
