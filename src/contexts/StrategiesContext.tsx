import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { nowISO, type ISODateString } from '@/lib/datetime';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  createdAt: ISODateString;
  checklistItems: string[];
}

interface StrategiesContextType {
  strategies: Strategy[];
  addStrategy: (name: string, description: string) => Strategy;
  removeStrategy: (id: string) => void;
  updateStrategy: (id: string, name: string, description: string) => void;
  updateStrategyChecklist: (id: string, checklistItems: string[]) => void;
  getStrategyById: (id: string) => Strategy | undefined;
  /**
   * Bulk reconcile strategies for import flows.
   * For each input, find an existing strategy by case-insensitive name (or
   * create one), then merge in any missing checklist items. Performed in a
   * single state write so callers can synchronously rely on the returned
   * lookup map without waiting for re-render.
   */
  reconcileStrategiesForImport: (
    inputs: { name: string; checklistItems: string[] }[],
  ) => {
    /** Map keyed by lowercased name → resolved Strategy (existing or new). */
    map: Map<string, Strategy>;
    strategiesCreated: number;
    checklistItemsCreated: number;
  };
}

const StrategiesContext = createContext<StrategiesContextType | undefined>(undefined);

const STRATEGIES_STORAGE_KEY = 'trading-journal-strategies';

export const StrategiesProvider = ({ children }: { children: ReactNode }) => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STRATEGIES_STORAGE_KEY);
      if (stored) {
        setStrategies(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading strategies from localStorage:', error);
      setStrategies([]);
    }
  }, []);

  const saveStrategies = useCallback((newStrategies: Strategy[]) => {
    localStorage.setItem(STRATEGIES_STORAGE_KEY, JSON.stringify(newStrategies));
    setStrategies(newStrategies);
  }, []);

  const addStrategy = useCallback((name: string, description: string): Strategy => {
    const trimmedName = name.trim();
    const newStrategy: Strategy = {
      id: crypto.randomUUID(),
      name: trimmedName,
      description: description.trim(),
      createdAt: nowISO(),
      checklistItems: [],
    };
    saveStrategies([...strategies, newStrategy]);
    return newStrategy;
  }, [strategies, saveStrategies]);

  const removeStrategy = useCallback((id: string) => {
    saveStrategies(strategies.filter(s => s.id !== id));
  }, [strategies, saveStrategies]);

  const updateStrategy = useCallback((id: string, name: string, description: string) => {
    const trimmedName = name.trim();
    saveStrategies(strategies.map(s => 
      s.id === id ? { ...s, name: trimmedName, description: description.trim() } : s
    ));
  }, [strategies, saveStrategies]);

  const updateStrategyChecklist = useCallback((id: string, checklistItems: string[]) => {
    saveStrategies(strategies.map(s => 
      s.id === id ? { ...s, checklistItems } : s
    ));
  }, [strategies, saveStrategies]);

  const getStrategyById = useCallback((id: string) => {
    return strategies.find(s => s.id === id);
  }, [strategies]);

  const reconcileStrategiesForImport = useCallback((
    inputs: { name: string; checklistItems: string[] }[],
  ) => {
    const map = new Map<string, Strategy>();
    let strategiesCreated = 0;
    let checklistItemsCreated = 0;

    let next = [...strategies];
    // Seed map with existing strategies (lowercased name key).
    for (const s of next) {
      map.set(s.name.trim().toLowerCase(), s);
    }

    for (const input of inputs) {
      const trimmedName = input.name.trim();
      if (!trimmedName) continue;
      const key = trimmedName.toLowerCase();
      let existing = map.get(key);

      if (!existing) {
        existing = {
          id: crypto.randomUUID(),
          name: trimmedName,
          description: '',
          createdAt: nowISO(),
          checklistItems: [],
        };
        next.push(existing);
        map.set(key, existing);
        strategiesCreated++;
      }

      // Merge missing checklist items (case-insensitive, preserve existing order).
      const existingLowered = new Set(existing.checklistItems.map(i => i.toLowerCase()));
      const additions: string[] = [];
      for (const item of input.checklistItems) {
        const trimmedItem = item.trim();
        if (!trimmedItem) continue;
        const lower = trimmedItem.toLowerCase();
        if (existingLowered.has(lower)) continue;
        existingLowered.add(lower);
        additions.push(trimmedItem);
      }
      if (additions.length > 0) {
        const merged = { ...existing, checklistItems: [...existing.checklistItems, ...additions] };
        next = next.map(s => s.id === merged.id ? merged : s);
        map.set(key, merged);
        checklistItemsCreated += additions.length;
      }
    }

    if (strategiesCreated > 0 || checklistItemsCreated > 0) {
      saveStrategies(next);
    }

    return { map, strategiesCreated, checklistItemsCreated };
  }, [strategies, saveStrategies]);

  return (
    <StrategiesContext.Provider value={{ strategies, addStrategy, removeStrategy, updateStrategy, updateStrategyChecklist, getStrategyById, reconcileStrategiesForImport }}>
      {children}
    </StrategiesContext.Provider>
  );
};

export const useStrategiesContext = () => {
  const context = useContext(StrategiesContext);
  if (!context) {
    throw new Error('useStrategiesContext must be used within StrategiesProvider');
  }
  return context;
};
