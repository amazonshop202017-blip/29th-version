import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { setContractSizeRegistry, setTickSizeRegistry } from '@/lib/contractSizeRegistry';
import { nowISO, type ISODateString } from '@/lib/datetime';

export interface TickPipRule {
  id: string;
  accountIds: string[];
  symbol: string;
  tickSize: number;
  contractSize: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

interface SymbolTickSizes {
  [symbol: string]: number;
}

interface SymbolContractSizes {
  [symbol: string]: number;
}

interface SymbolTickSizeContextType {
  tickSizes: SymbolTickSizes;
  contractSizes: SymbolContractSizes;
  setTickSize: (symbol: string, size: number) => void;
  setAllTickSizes: (sizes: SymbolTickSizes) => void;
  getTickSize: (symbol: string) => number | undefined;
  setContractSize: (symbol: string, size: number) => void;
  setAllContractSizes: (sizes: SymbolContractSizes) => void;
  getContractSize: (symbol: string) => number | undefined;
  // Rule-based API
  tickPipRules: TickPipRule[];
  addTickPipRule: (rule: Omit<TickPipRule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTickPipRule: (id: string, rule: Partial<Omit<TickPipRule, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteTickPipRule: (id: string) => void;
  getTickSizeForAccountSymbol: (accountId: string, symbol: string) => number | undefined;
  getContractSizeForAccountSymbol: (accountId: string, symbol: string) => number;
}

const STORAGE_KEY = 'symbol-tick-sizes';
const CONTRACT_STORAGE_KEY = 'symbol-contract-sizes';
const RULES_STORAGE_KEY = 'trading-journal-tickpip-rules';

const SymbolTickSizeContext = createContext<SymbolTickSizeContextType | undefined>(undefined);

/** Migrate legacy rules — drop accountNames, keep accountIds only */
const migrateRule = (raw: any): TickPipRule => {
  const rule: TickPipRule = {
    id: raw.id,
    accountIds: raw.accountIds || [],
    symbol: raw.symbol,
    tickSize: raw.tickSize,
    contractSize: raw.contractSize,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
  // Legacy single-account migration
  if (rule.accountIds.length === 0 && raw.accountId) {
    rule.accountIds = [raw.accountId];
  }
  return rule;
};

const loadRules = (): TickPipRule[] => {
  try {
    const stored = localStorage.getItem(RULES_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as any[];
    return parsed.map(migrateRule);
  } catch {
    return [];
  }
};

const saveRules = (rules: TickPipRule[]) => {
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
};

export const SymbolTickSizeProvider = ({ children }: { children: ReactNode }) => {
  const [tickSizes, setTickSizes] = useState<SymbolTickSizes>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [contractSizes, setContractSizes] = useState<SymbolContractSizes>(() => {
    try {
      const stored = localStorage.getItem(CONTRACT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      setContractSizeRegistry(parsed);
      return parsed;
    } catch {
      return {};
    }
  });

  const [tickPipRules, setTickPipRules] = useState<TickPipRule[]>(loadRules);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickSizes));
    setTickSizeRegistry(tickSizes);
  }, [tickSizes]);

  useEffect(() => {
    localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(contractSizes));
    setContractSizeRegistry(contractSizes);
  }, [contractSizes]);

  const setTickSizeValue = (symbol: string, size: number) => {
    setTickSizes(prev => ({ ...prev, [symbol]: size }));
  };

  const setAllTickSizes = (sizes: SymbolTickSizes) => {
    setTickSizes(sizes);
  };

  const getTickSize = (symbol: string): number | undefined => {
    return tickSizes[symbol];
  };

  const setContractSizeValue = (symbol: string, size: number) => {
    setContractSizes(prev => ({ ...prev, [symbol]: size }));
  };

  const setAllContractSizes = (sizes: SymbolContractSizes) => {
    setContractSizes(sizes);
  };

  const getContractSize = (symbol: string): number | undefined => {
    return contractSizes[symbol];
  };

  // Rule CRUD
  const addTickPipRule = (rule: Omit<TickPipRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = nowISO();
    const newRule: TickPipRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...tickPipRules, newRule];
    setTickPipRules(updated);
    saveRules(updated);
  };

  const updateTickPipRule = (id: string, patch: Partial<Omit<TickPipRule, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const updated = tickPipRules.map(r =>
      r.id === id ? { ...r, ...patch, updatedAt: nowISO() } : r
    );
    setTickPipRules(updated);
    saveRules(updated);
  };

  const deleteTickPipRule = (id: string) => {
    const updated = tickPipRules.filter(r => r.id !== id);
    setTickPipRules(updated);
    saveRules(updated);
  };

  // Account+Symbol lookup — uses accountIds (UUIDs)
  const getTickSizeForAccountSymbol = (accountId: string, symbol: string): number | undefined => {
    const accountRule = tickPipRules.find(
      r => r.accountIds.includes(accountId) && r.symbol === symbol
    );
    return accountRule ? accountRule.tickSize : undefined;
  };

  const getContractSizeForAccountSymbol = (accountId: string, symbol: string): number => {
    const accountRule = tickPipRules.find(
      r => r.accountIds.includes(accountId) && r.symbol === symbol
    );
    return accountRule ? accountRule.contractSize : 1;
  };

  return (
    <SymbolTickSizeContext.Provider value={{
      tickSizes, contractSizes,
      setTickSize: setTickSizeValue, setAllTickSizes, getTickSize,
      setContractSize: setContractSizeValue, setAllContractSizes, getContractSize,
      tickPipRules, addTickPipRule, updateTickPipRule, deleteTickPipRule,
      getTickSizeForAccountSymbol, getContractSizeForAccountSymbol,
    }}>
      {children}
    </SymbolTickSizeContext.Provider>
  );
};

export const useSymbolTickSize = (): SymbolTickSizeContextType => {
  const context = useContext(SymbolTickSizeContext);
  if (context === undefined) {
    throw new Error('useSymbolTickSize must be used within SymbolTickSizeProvider');
  }
  return context;
};
