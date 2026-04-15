import { useState, useEffect, useCallback } from 'react';
import { Trade, TradeFormData, calculateTradeMetrics } from '@/types/trade';
import { getContractSizeForSymbol } from '@/lib/contractSizeRegistry';

const getCurrentUserId = (): string | undefined => {
  try {
    const session = localStorage.getItem('auth_session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.userId;
    }
  } catch {}
  return undefined;
};

const STORAGE_KEY = 'trading-journal-trades';

export const useTrades = () => {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old trades
        const migrated = parsed.map((trade: any) => {
          try {
          let updated = trade;
          
          // Migration 1: Convert trades without entries array
          if (!updated.entries) {
            updated = {
              ...updated,
              entries: [],
              notes: updated.notes || '',
            };
          }
          
          // Migration: Remove deprecated instrument field (asset class concept)
          if ('instrument' in updated) {
            const { instrument, ...rest } = updated;
            updated = rest;
          }
          
          // Migration: Backfill contractSize from registry for pre-existing trades
          if (updated.contractSize === undefined && updated.symbol) {
            updated = {
              ...updated,
              contractSize: getContractSizeForSymbol(updated.symbol),
            };
          }
          
          // Migration: Backfill userId from current session for pre-existing trades
          if (!updated.userId) {
            const currentUserId = getCurrentUserId();
            if (currentUserId) {
              updated = { ...updated, userId: currentUserId };
            }
          }
          
          // Migration: Normalize mfeTickPip/maeTickPip — ensure they are number|null, never undefined
          if (updated.mfeTickPip === undefined) {
            updated = { ...updated, mfeTickPip: null };
          }
          if (updated.maeTickPip === undefined) {
            updated = { ...updated, maeTickPip: null };
          }
          
          // Calculate metrics once for all derived field reconciliation
          const metrics = calculateTradeMetrics(updated);
          
          // Migration 2: Reconcile savedRMultiple
          // Handles: undefined, null, AND stale zero values (stored 0 when should be non-zero)
          // This ensures backward compatibility when new derived fields are added
          if (updated.tradeRisk > 0 && metrics.positionStatus === 'CLOSED') {
            const calculatedRMultiple = metrics.netPnl / updated.tradeRisk;
            const isMissing = updated.savedRMultiple === undefined || updated.savedRMultiple === null;
            const isStaleZero = updated.savedRMultiple === 0 && Math.abs(calculatedRMultiple) > 0.0001;
            
            if (isMissing || isStaleZero) {
              updated = {
                ...updated,
                savedRMultiple: calculatedRMultiple,
              };
            }
          }
          
          // Migration 3: Reconcile savedReturnPercent
          // AUTHORITATIVE DEFINITION: Return % = (Net P&L / Account Balance at Trade Time) × 100
          // Handles: undefined, null, AND stale zero values
          if (updated.accountBalanceSnapshot && updated.accountBalanceSnapshot > 0) {
            const netPnl = updated.manualGrossPnl !== undefined 
              ? updated.manualGrossPnl - metrics.totalCharges 
              : metrics.netPnl;
            const calculatedReturnPercent = (netPnl / updated.accountBalanceSnapshot) * 100;
            
            const isMissing = updated.savedReturnPercent === undefined || updated.savedReturnPercent === null;
            const isStaleZero = updated.savedReturnPercent === 0 && Math.abs(calculatedReturnPercent) > 0.0001;
            
            if (isMissing || isStaleZero) {
              updated = {
                ...updated,
                savedReturnPercent: calculatedReturnPercent,
              };
            }
          } else if (metrics.positionStatus === 'CLOSED') {
            // Legacy trade without account balance - only set to 0 if truly missing
            if (updated.savedReturnPercent === undefined || updated.savedReturnPercent === null) {
              updated = {
                ...updated,
                savedReturnPercent: 0,
              };
            }
          }
          
          return updated;
          } catch (err) {
            console.error('[useTrades] Migration error for trade:', trade?.id, err);
            // Return trade as-is with safe defaults to prevent app crash
            return { ...trade, mfeTickPip: trade.mfeTickPip ?? null, maeTickPip: trade.maeTickPip ?? null };
          }
        }).filter(Boolean);
        setTrades(migrated);
        // Save migrated trades back to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
    } catch (error) {
      console.error('Error loading trades from localStorage:', error);
      setTrades([]);
    }
  }, []);

  const saveTrades = useCallback((newTrades: Trade[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTrades));
    setTrades(newTrades);
  }, []);

  const addTrade = useCallback((data: TradeFormData) => {
    const newTrade: Trade = {
      ...data,
      id: crypto.randomUUID(),
      userId: getCurrentUserId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveTrades([...trades, newTrade]);
    return newTrade;
  }, [trades, saveTrades]);

  const bulkAddTrades = useCallback((tradesData: TradeFormData[]): Trade[] => {
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    const newTrades: Trade[] = tradesData.map(data => ({
      ...data,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    }));
    saveTrades([...trades, ...newTrades]);
    return newTrades;
  }, [trades, saveTrades]);

  const updateTrade = useCallback((id: string, data: TradeFormData) => {
    const updated = trades.map(trade =>
      trade.id === id
        ? { ...trade, ...data, updatedAt: new Date().toISOString() }
        : trade
    );
    saveTrades(updated);
  }, [trades, saveTrades]);

  // Bulk update multiple trades atomically (avoids stale closure issues with looped updateTrade)
  const bulkUpdateTrades = useCallback((updates: Map<string, Partial<TradeFormData>>) => {
    const now = new Date().toISOString();
    const updated = trades.map(trade => {
      const patch = updates.get(trade.id);
      if (patch) {
        return { ...trade, ...patch, updatedAt: now };
      }
      return trade;
    });
    saveTrades(updated);
  }, [trades, saveTrades]);

  const deleteTrade = useCallback((id: string) => {
    saveTrades(trades.filter(trade => trade.id !== id));
  }, [trades, saveTrades]);

  // Atomic bulk delete to avoid stale-closure issues when deleting multiple trades
  const deleteTrades = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    saveTrades(trades.filter(trade => !idSet.has(trade.id)));
  }, [trades, saveTrades]);

  const deleteTradesByAccountId = useCallback((accountId: string) => {
    saveTrades(trades.filter(trade => trade.accountId !== accountId));
  }, [trades, saveTrades]);

  const deleteTradesByAccountName = useCallback((accountName: string) => {
    saveTrades(trades.filter(trade => trade.accountName !== accountName));
  }, [trades, saveTrades]);

  const getTradeById = useCallback((id: string) => {
    return trades.find(trade => trade.id === id);
  }, [trades]);

  // Stats calculations using the new calculateTradeMetrics
  const winningTrades = trades.filter(t => calculateTradeMetrics(t).netPnl > 0);
  const losingTrades = trades.filter(t => calculateTradeMetrics(t).netPnl < 0);
  const breakevenTrades = trades.filter(t => calculateTradeMetrics(t).netPnl === 0);
  
  const totalProfits = winningTrades.reduce((sum, t) => sum + calculateTradeMetrics(t).netPnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + calculateTradeMetrics(t).netPnl, 0));
  
  // Calculate day-based stats
  const dayPnl = trades.reduce((acc, t) => {
    const metrics = calculateTradeMetrics(t);
    const day = metrics.closeDate ? metrics.closeDate.split('T')[0] : 'unknown';
    acc[day] = (acc[day] || 0) + metrics.netPnl;
    return acc;
  }, {} as Record<string, number>);
  
  const days = Object.values(dayPnl);
  const winningDaysCount = days.filter(p => p > 0).length;
  const losingDaysCount = days.filter(p => p < 0).length;
  const breakevenDaysCount = days.filter(p => p === 0).length;
  
  const stats = {
    netPnl: trades.reduce((sum, t) => sum + calculateTradeMetrics(t).netPnl, 0),
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    breakevenTrades: breakevenTrades.length,
    tradeWinRate: trades.length > 0 
      ? (winningTrades.length / trades.length) * 100 
      : 0,
    dayWinRate: days.length > 0 
      ? (winningDaysCount / days.length) * 100 
      : 0,
    winningDays: winningDaysCount,
    losingDays: losingDaysCount,
    breakevenDays: breakevenDaysCount,
    avgWin: winningTrades.length > 0 
      ? totalProfits / winningTrades.length 
      : 0,
    avgLoss: losingTrades.length > 0 
      ? -(totalLosses / losingTrades.length) 
      : 0,
    totalProfits,
    totalLosses,
    profitFactor: totalLosses > 0 ? totalProfits / totalLosses : (totalProfits > 0 ? Infinity : 0),
  };

  return {
    trades,
    stats,
    addTrade,
    bulkAddTrades,
    updateTrade,
    bulkUpdateTrades,
    deleteTrade,
    deleteTrades,
    deleteTradesByAccountId,
    deleteTradesByAccountName,
    getTradeById,
  };
};
