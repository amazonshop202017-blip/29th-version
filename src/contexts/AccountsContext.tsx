import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useTradesContext } from './TradesContext';
import { useAuth } from './AuthContext';
import { calculateTradeMetrics } from '@/types/trade';

export type AccountMode = 'normal' | 'propfirm';
export type PropFirmPhase = 'evaluation' | 'funded';
export type PropFirmStatus = 'active' | 'breached' | 'funded';
export type PropFirmStepType = '1' | '2' | 'funded';

export interface Account {
  id: string;
  accountId: string;
  userId: string;
  name: string;
  startingBalance: number;
  createdAt: string;
  isArchived?: boolean;
  accountMode: AccountMode;
  // Propfirm-specific fields (only set when created from PropFirm flow)
  challengeId?: string;
  step?: PropFirmStepType;
  phase?: PropFirmPhase;
  status?: PropFirmStatus;
  breachReason?: string;
  breachedAt?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  date: string;
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
        setAccounts(JSON.parse(stored));
      }
      const storedTransactions = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      if (storedTransactions) {
        setTransactions(JSON.parse(storedTransactions));
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
      accountId: generateUniqueAccountId(),
      userId: user?.userId || '',
      name: name.trim(),
      startingBalance,
      createdAt: new Date().toISOString(),
      isArchived: false,
      accountMode,
      ...(accountMode === 'propfirm' && propFirmFields ? {
        challengeId: propFirmFields.challengeId,
        step: propFirmFields.step,
        phase: propFirmFields.phase,
        status: propFirmFields.status,
      } : {}),
    };
    saveAccounts([...accounts, newAccount]);
    return newAccount;
  }, [accounts, saveAccounts, generateUniqueAccountId]);

  const removeAccount = useCallback((id: string) => {
    saveAccounts(accounts.filter(a => a.id !== id));
    // Also remove transactions for this account
    saveTransactions(transactions.filter(t => t.accountId !== id));
  }, [accounts, transactions, saveAccounts, saveTransactions]);

  const updateAccount = useCallback((id: string, name: string, startingBalance: number, accountMode?: AccountMode) => {
    saveAccounts(accounts.map(a => 
      a.id === id ? { ...a, name: name.trim(), startingBalance, ...(accountMode !== undefined && { accountMode }) } : a
    ));
  }, [accounts, saveAccounts]);

  const getAccountById = useCallback((id: string) => {
    return accounts.find(a => a.id === id);
  }, [accounts]);

  const archiveAccount = useCallback((id: string) => {
    saveAccounts(accounts.map(a => 
      a.id === id ? { ...a, isArchived: true } : a
    ));
  }, [accounts, saveAccounts]);

  const unarchiveAccount = useCallback((id: string) => {
    saveAccounts(accounts.map(a => 
      a.id === id ? { ...a, isArchived: false } : a
    ));
  }, [accounts, saveAccounts]);

  const deleteAccountPermanently = useCallback((id: string) => {
    // Only allow deletion of archived accounts
    const account = accounts.find(a => a.id === id);
    if (!account?.isArchived) return;
    
    saveAccounts(accounts.filter(a => a.id !== id));
    // Also remove transactions for this account
    saveTransactions(transactions.filter(t => t.accountId !== id));
  }, [accounts, transactions, saveAccounts, saveTransactions]);

  const addTransaction = useCallback((accountId: string, type: 'deposit' | 'withdraw', amount: number, note?: string) => {
    if (!user?.userId) return;
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId,
      type,
      amount,
      date: new Date().toISOString(),
      note,
    };
    saveTransactions([...transactions, newTransaction]);
  }, [transactions, saveTransactions, user]);

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

  return (
    <AccountsContext.Provider value={{
      accounts,
      transactions,
      addAccount,
      removeAccount,
      updateAccount,
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
