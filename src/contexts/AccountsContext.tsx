import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useTradesContext } from './TradesContext';
import { useAuth } from './AuthContext';
import { calculateTradeMetrics } from '@/types/trade';
import { toISO, nowISO, type ISODateString } from '@/lib/datetime';

export type AccountMode = 'normal' | 'propfirm';
export type PropFirmPhase = 'evaluation' | 'funded';
export type PropFirmStatus = 'active' | 'completed' | 'breached' | 'funded';
export type PropFirmStepType = '1' | '2' | 'funded';

export interface Account {
  id: string;
  accountId: string;
  userId: string;
  name: string;
  startingBalance: number;
  createdAt: ISODateString;
  isArchived?: boolean;
  accountMode: AccountMode;
  // Propfirm-specific fields (only set when created from PropFirm flow)
  challengeId?: string;
  step?: PropFirmStepType;
  phase?: PropFirmPhase;
  status?: PropFirmStatus;
  breachReason?: string;
  breachedAt?: ISODateString;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  date: ISODateString;
  note?: string;
}

export interface AccountWithStats extends Account {
  currentBalance: number;
  pnl: number;
  roi: number;
}

interface AccountsContextType {
  accounts: Account[];
  transactions: Transaction[];
  addAccount: (name: string, startingBalance: number, accountMode?: AccountMode, propFirmFields?: { challengeId?: string; step?: PropFirmStepType; phase?: PropFirmPhase; status?: PropFirmStatus }) => Account;
  removeAccount: (id: string) => void;
  updateAccount: (id: string, name: string, startingBalance: number, accountMode?: AccountMode) => void;
  patchAccount: (id: string, patch: Partial<Pick<Account, 'name' | 'phase' | 'step' | 'status' | 'breachReason' | 'breachedAt' | 'isArchived'>>) => void;
  getAccountById: (id: string) => Account | undefined;
  getAccountWithStats: (id: string) => AccountWithStats | undefined;
  getAllAccountsWithStats: () => AccountWithStats[];
  getActiveAccountsWithStats: () => AccountWithStats[];
  getArchivedAccountsWithStats: () => AccountWithStats[];
  archiveAccount: (id: string) => void;
  unarchiveAccount: (id: string) => void;
  deleteAccountPermanently: (id: string) => void;
  addTransaction: (accountId: string, type: 'deposit' | 'withdraw', amount: number, note?: string) => void;
  getTransactionsForAccount: (accountId: string) => Transaction[];
  getActiveAccountIds: () => string[];
  // Get account balance BEFORE any trade P/L (starting balance + transactions only)
  getAccountBalanceBeforeTrades: (id: string) => number;
  // Get all accounts (active + archived) linked to a challenge
  getAccountsByChallengeId: (challengeId: string) => Account[];
}

const AccountsContext = createContext<AccountsContextType | undefined>(undefined);

const STORAGE_KEY = 'trading-journal-accounts';
const TRANSACTIONS_STORAGE_KEY = 'trading-journal-transactions';

export const AccountsProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { trades } = useTradesContext();
  const { user } = useAuth();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Account[] = JSON.parse(stored);
        let changed = false;
        const migrated = parsed.map(a => {
          const nextCreated = toISO(a.createdAt) || a.createdAt;
          const nextBreached = a.breachedAt ? (toISO(a.breachedAt) || a.breachedAt) : a.breachedAt;
          if (nextCreated !== a.createdAt || nextBreached !== a.breachedAt) changed = true;
          return { ...a, createdAt: nextCreated, breachedAt: nextBreached };
        });
        setAccounts(migrated);
        if (changed) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          console.log('[AccountsContext] Normalized legacy account dates to ISO UTC.');
        }
      }
      const storedTransactions = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      if (storedTransactions) {
        const parsedTx: Transaction[] = JSON.parse(storedTransactions);
        let txChanged = false;
        const migratedTx = parsedTx.map(t => {
          const nextDate = toISO(t.date) || t.date;
          if (nextDate !== t.date) txChanged = true;
          return { ...t, date: nextDate };
        });
        setTransactions(migratedTx);
        if (txChanged) {
          localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(migratedTx));
          console.log('[AccountsContext] Normalized legacy transaction dates to ISO UTC.');
        }
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }, []);

  const saveAccounts = useCallback((newAccounts: Account[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAccounts));
    setAccounts(newAccounts);
  }, []);

  const saveTransactions = useCallback((newTransactions: Transaction[]) => {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(newTransactions));
    setTransactions(newTransactions);
  }, []);

  const generateUniqueAccountId = useCallback((): string => {
    const existing = new Set(accounts.map(a => a.accountId).filter(Boolean));
    let id: string;
    do {
      id = String(Math.floor(10000000 + Math.random() * 90000000));
    } while (existing.has(id));
    return id;
  }, [accounts]);

  const addAccount = useCallback((name: string, startingBalance: number, accountMode: AccountMode = 'normal', propFirmFields?: { challengeId?: string; step?: PropFirmStepType; phase?: PropFirmPhase; status?: PropFirmStatus }) => {
    const newAccount: Account = {
      id: crypto.randomUUID(),
      accountId: '', // filled below using latest state to avoid collisions
      userId: user?.userId || '',
      name: name.trim(),
      startingBalance,
      createdAt: nowISO(),
      isArchived: false,
      accountMode,
      ...(accountMode === 'propfirm' && propFirmFields ? {
        challengeId: propFirmFields.challengeId,
        step: propFirmFields.step,
        phase: propFirmFields.phase,
        status: propFirmFields.status,
      } : {}),
    };
    // Use functional update so we merge with the latest (post-patch) state, not stale closure state.
    setAccounts(prev => {
      const existing = new Set(prev.map(a => a.accountId).filter(Boolean));
      let id: string;
      do {
        id = String(Math.floor(10000000 + Math.random() * 90000000));
      } while (existing.has(id));
      newAccount.accountId = id;
      const next = [...prev, newAccount];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return newAccount;
  }, [user?.userId]);

  const removeAccount = useCallback((id: string) => {
    setAccounts(prev => {
      const next = prev.filter(a => a.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setTransactions(prev => {
      const next = prev.filter(t => t.accountId !== id);
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateAccount = useCallback((id: string, name: string, startingBalance: number, accountMode?: AccountMode) => {
    setAccounts(prev => {
      const next = prev.map(a =>
        a.id === id ? { ...a, name: name.trim(), startingBalance, ...(accountMode !== undefined && { accountMode }) } : a
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const patchAccount = useCallback((id: string, patch: Partial<Pick<Account, 'name' | 'phase' | 'step' | 'status' | 'breachReason' | 'breachedAt' | 'isArchived'>>) => {
    setAccounts(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...patch } : a);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getAccountById = useCallback((id: string) => {
    return accounts.find(a => a.id === id);
  }, [accounts]);

  const archiveAccount = useCallback((id: string) => {
    setAccounts(prev => {
      const next = prev.map(a => a.id === id ? { ...a, isArchived: true } : a);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const unarchiveAccount = useCallback((id: string) => {
    setAccounts(prev => {
      const next = prev.map(a => a.id === id ? { ...a, isArchived: false } : a);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteAccountPermanently = useCallback((id: string) => {
    setAccounts(prev => {
      const target = prev.find(a => a.id === id);
      if (!target?.isArchived) return prev;
      const next = prev.filter(a => a.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setTransactions(prev => {
      const next = prev.filter(t => t.accountId !== id);
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addTransaction = useCallback((accountId: string, type: 'deposit' | 'withdraw', amount: number, note?: string) => {
    if (!user?.userId) return;
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId,
      type,
      amount,
      date: nowISO(),
      note,
    };
    setTransactions(prev => {
      const next = [...prev, newTransaction];
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [user]);

  const getTransactionsForAccount = useCallback((accountId: string) => {
    return transactions.filter(t => t.accountId === accountId);
  }, [transactions]);

  // Helper function to calculate account stats
  const calculateAccountStats = useCallback((account: Account): AccountWithStats => {
    const accountTrades = trades.filter(t => t.accountId === account.id);
    const tradePnl = accountTrades.reduce((sum, t) => sum + calculateTradeMetrics(t).netPnl, 0);
    
    const accountTransactions = transactions.filter(t => t.accountId === account.id);
    const depositTotal = accountTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const withdrawTotal = accountTransactions
      .filter(t => t.type === 'withdraw')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const adjustedStartingBalance = account.startingBalance + depositTotal - withdrawTotal;
    const currentBalance = adjustedStartingBalance + tradePnl;
    const roi = adjustedStartingBalance > 0 
      ? ((currentBalance - adjustedStartingBalance) / adjustedStartingBalance) * 100 
      : 0;

    return {
      ...account,
      currentBalance,
      pnl: tradePnl,
      roi,
    };
  }, [trades, transactions]);

  const getAccountWithStats = useCallback((id: string): AccountWithStats | undefined => {
    const account = accounts.find(a => a.id === id);
    if (!account) return undefined;
    return calculateAccountStats(account);
  }, [accounts, calculateAccountStats]);

  const getAllAccountsWithStats = useCallback((): AccountWithStats[] => {
    return accounts.map(account => calculateAccountStats(account));
  }, [accounts, calculateAccountStats]);

  const getActiveAccountsWithStats = useCallback((): AccountWithStats[] => {
    return accounts
      .filter(a => !a.isArchived)
      .map(account => calculateAccountStats(account));
  }, [accounts, calculateAccountStats]);

  const getArchivedAccountsWithStats = useCallback((): AccountWithStats[] => {
    return accounts
      .filter(a => a.isArchived)
      .map(account => calculateAccountStats(account));
  }, [accounts, calculateAccountStats]);

  const getActiveAccountIds = useCallback((): string[] => {
    return accounts.filter(a => !a.isArchived).map(a => a.id);
  }, [accounts]);

  // Get account balance BEFORE any trade P/L is applied
  // This is: startingBalance + deposits - withdrawals (NO trade P/L)
  const getAccountBalanceBeforeTrades = useCallback((id: string): number => {
    const account = accounts.find(a => a.id === id);
    if (!account) return 0;

    const accountTransactions = transactions.filter(t => t.accountId === id);
    const depositTotal = accountTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const withdrawTotal = accountTransactions
      .filter(t => t.type === 'withdraw')
      .reduce((sum, t) => sum + t.amount, 0);

    return account.startingBalance + depositTotal - withdrawTotal;
  }, [accounts, transactions]);

  const getAccountsByChallengeId = useCallback((challengeId: string): Account[] => {
    return accounts.filter(a => a.challengeId === challengeId);
  }, [accounts]);

  return (
    <AccountsContext.Provider value={{
      accounts,
      transactions,
      addAccount,
      removeAccount,
      updateAccount,
      patchAccount,
      getAccountById,
      getAccountWithStats,
      getAllAccountsWithStats,
      getActiveAccountsWithStats,
      getArchivedAccountsWithStats,
      archiveAccount,
      unarchiveAccount,
      deleteAccountPermanently,
      addTransaction,
      getTransactionsForAccount,
      getActiveAccountIds,
      getAccountBalanceBeforeTrades,
      getAccountsByChallengeId,
    }}>
      {children}
    </AccountsContext.Provider>
  );
};

export const useAccountsContext = () => {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error('useAccountsContext must be used within an AccountsProvider');
  }
  return context;
};
