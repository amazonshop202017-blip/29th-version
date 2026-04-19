import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { nowISO, isCanonicalISO, type ISODateString } from '@/lib/datetime';

export type TxType = 'income' | 'expense';
export type TxStatus = 'reviewed' | 'not_reviewed' | 'ignored';
export type TxCategory =
  | 'evaluation_fee'
  | 'activation_fee'
  | 'payout'
  | 'refund'
  | 'commission'
  | 'other_income'
  | 'other_expense';

export interface PropFirmTransaction {
  id: string;
  userId: string;
  accountId?: string;
  challengeId?: string;
  firm: string;
  type: TxType;
  category: TxCategory;
  description?: string;
  amount: number; // Always positive
  date: ISODateString;
  status: TxStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type NewTransactionInput = Omit<PropFirmTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

interface TransactionsContextType {
  transactions: PropFirmTransaction[];
  addTransaction: (input: NewTransactionInput) => PropFirmTransaction;
  updateTransaction: (id: string, patch: Partial<Omit<PropFirmTransaction, 'id' | 'userId' | 'createdAt'>>) => void;
  deleteTransaction: (id: string) => void;
  bulkUpdateStatus: (ids: string[], status: TxStatus) => void;
  bulkDelete: (ids: string[]) => void;
  getByChallengeId: (challengeId: string) => PropFirmTransaction[];
  getByAccountId: (accountId: string) => PropFirmTransaction[];
  // Idempotent helper for auto-sync (returns true if created)
  ensureTransaction: (predicate: (t: PropFirmTransaction) => boolean, factory: () => NewTransactionInput) => boolean;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);
const STORAGE_KEY = 'propfirm-transactions-v1';

function uid() {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const TransactionsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<PropFirmTransaction[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTransactions(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading propfirm transactions:', e);
    }
  }, []);

  const persist = (next: PropFirmTransaction[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  };

  const addTransaction = useCallback((input: NewTransactionInput): PropFirmTransaction => {
    const now = nowISO();
    const tx: PropFirmTransaction = {
      ...input,
      id: uid(),
      userId: user?.userId || 'local',
      createdAt: now,
      updatedAt: now,
      amount: Math.abs(input.amount),
    };
    setTransactions(prev => persist([...prev, tx]));
    return tx;
  }, [user]);

  const updateTransaction = useCallback((id, patch) => {
    setTransactions(prev => persist(prev.map(t => t.id === id ? { ...t, ...patch, amount: patch.amount !== undefined ? Math.abs(patch.amount) : t.amount, updatedAt: nowISO() } : t)));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => persist(prev.filter(t => t.id !== id)));
  }, []);

  const bulkUpdateStatus = useCallback((ids: string[], status: TxStatus) => {
    const set = new Set(ids);
    setTransactions(prev => persist(prev.map(t => set.has(t.id) ? { ...t, status, updatedAt: new Date().toISOString() } : t)));
  }, []);

  const bulkDelete = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setTransactions(prev => persist(prev.filter(t => !set.has(t.id))));
  }, []);

  const getByChallengeId = useCallback((cid: string) => transactions.filter(t => t.challengeId === cid), [transactions]);
  const getByAccountId = useCallback((aid: string) => transactions.filter(t => t.accountId === aid), [transactions]);

  const ensureTransaction = useCallback((predicate, factory): boolean => {
    let created = false;
    setTransactions(prev => {
      if (prev.some(predicate)) return prev;
      const input = factory();
      const now = new Date().toISOString();
      const tx: PropFirmTransaction = {
        ...input,
        id: uid(),
        userId: user?.userId || 'local',
        createdAt: now,
        updatedAt: now,
        amount: Math.abs(input.amount),
      };
      created = true;
      return persist([...prev, tx]);
    });
    return created;
  }, [user]);

  return (
    <TransactionsContext.Provider value={{
      transactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      bulkUpdateStatus,
      bulkDelete,
      getByChallengeId,
      getByAccountId,
      ensureTransaction,
    }}>
      {children}
    </TransactionsContext.Provider>
  );
};

export const useTransactionsContext = () => {
  const ctx = useContext(TransactionsContext);
  if (!ctx) throw new Error('useTransactionsContext must be used within TransactionsProvider');
  return ctx;
};

export const CATEGORY_LABELS: Record<TxCategory, string> = {
  evaluation_fee: 'Evaluation Fee',
  activation_fee: 'Activation Fee',
  payout: 'Payout',
  refund: 'Refund',
  commission: 'Commission',
  other_income: 'Other Income',
  other_expense: 'Other Expense',
};

export const INCOME_CATEGORIES: TxCategory[] = ['payout', 'refund', 'commission', 'other_income'];
export const EXPENSE_CATEGORIES: TxCategory[] = ['evaluation_fee', 'activation_fee', 'other_expense'];
