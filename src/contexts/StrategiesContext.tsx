import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { ISODateString } from '@/lib/datetime';

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

  return (
    <StrategiesContext.Provider value={{ strategies, addStrategy, removeStrategy, updateStrategy, updateStrategyChecklist, getStrategyById }}>
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
