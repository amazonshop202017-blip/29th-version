import { useState, useEffect, useCallback } from 'react';
import { Trade, TradeFormData, calculateTradeMetrics } from '@/types/trade';
import { getContractSizeForSymbol } from '@/lib/contractSizeRegistry';
import { toISO, nowISO, auditISOValues } from '@/lib/datetime';
import { buildFingerprintForTrade } from '@/lib/tradeFingerprint';

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

/**
 * Recompute the three derived "saved*" fields from the trade's current inputs.
 * Called on every add/update so that any change to entries, SL, TP, risk,
 * fees, manual P&L, or account balance snapshot is reflected in storage.
 *
 * - savedRMultiple = netPnl / tradeRisk        (achieved RR)
 * - savedRRR       = |TP-Entry| / |Entry-SL|   (planned RR)
 * - savedReturnPercent = netPnl / accountBalanceSnapshot * 100
 */
const reconcileSavedFields = <T extends Partial<Trade>>(trade: T): T => {
  const next: any = { ...trade };
  const metrics = calculateTradeMetrics(next as Trade);

  // savedRMultiple — achieved R from net P&L vs trade risk
  if (typeof next.tradeRisk === 'number' && next.tradeRisk > 0 && metrics.positionStatus === 'CLOSED') {
    next.savedRMultiple = metrics.netPnl / next.tradeRisk;
  } else {
    next.savedRMultiple = undefined;
  }

  // savedRRR — planned RR from entry / SL / TP
  const entry = metrics.avgEntryPrice;
  const sl = next.stopLoss;
  const tp = next.takeProfit;
  if (
    typeof entry === 'number' && entry > 0 &&
    typeof sl === 'number' && sl > 0 &&
    typeof tp === 'number' && tp > 0 &&
    next.side
  ) {
    const risk = next.side === 'LONG' ? entry - sl : sl - entry;
    const reward = next.side === 'LONG' ? tp - entry : entry - tp;
    next.savedRRR = risk > 0 && reward > 0 ? reward / risk : undefined;
  } else {
    next.savedRRR = undefined;
  }

  // savedReturnPercent — from net P&L vs account balance snapshot
  if (typeof next.accountBalanceSnapshot === 'number' && next.accountBalanceSnapshot > 0) {
    next.savedReturnPercent = (metrics.netPnl / next.accountBalanceSnapshot) * 100;
  } else {
    next.savedReturnPercent = undefined;
  }

  return next as T;
};

export const useTrades = () => {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Load accounts from localStorage for migration (avoids context dependency)
        let accountsList: any[] = [];
        try {
          const storedAccounts = localStorage.getItem('trading-journal-accounts');
          if (storedAccounts) accountsList = JSON.parse(storedAccounts);
        } catch {}

        let migrationReport = { migrated: 0, skipped: 0 };

        const parsed = JSON.parse(stored);
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

          // Migration: Normalize entry datetimes to full ISO 8601 UTC.
          // Naive legacy values (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss) are
          // interpreted as user local time — same as how the UI originally
          // saved them — so the displayed day/time stays identical.
          if (Array.isArray(updated.entries) && updated.entries.length > 0) {
            let entriesChanged = false;
            const normalizedEntries = updated.entries.map((e: any) => {
              if (!e?.datetime) return e;
              const next = toISO(e.datetime);
              if (next && next !== e.datetime) {
                entriesChanged = true;
                return { ...e, datetime: next };
              }
              return e;
            });
            if (entriesChanged) {
              updated = { ...updated, entries: normalizedEntries };
            }
          }
          
          // Migration: Normalize createdAt / updatedAt
          if (updated.createdAt) {
            const next = toISO(updated.createdAt);
            if (next && next !== updated.createdAt) updated = { ...updated, createdAt: next };
          }
          if (updated.updatedAt) {
            const next = toISO(updated.updatedAt);
            if (next && next !== updated.updatedAt) updated = { ...updated, updatedAt: next };
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
          
          // Migration: Rename old field names → new camelCase names
          if ('farthestPriceInProfit' in updated) {
            const { farthestPriceInProfit, ...rest } = updated;
            updated = { ...rest, preMfePrice: farthestPriceInProfit };
          }
          if ('farthestPriceInLoss' in updated) {
            const { farthestPriceInLoss, ...rest } = updated;
            updated = { ...rest, preMaePrice: farthestPriceInLoss };
          }
          if ('mfeTickPip' in updated) {
            const { mfeTickPip, ...rest } = updated;
            updated = { ...rest, preMfeTickPip: mfeTickPip };
          }
          if ('maeTickPip' in updated) {
            const { maeTickPip, ...rest } = updated;
            updated = { ...rest, preMaeTickPip: maeTickPip };
          }

          // Migration: Normalize preMfeTickPip/preMaeTickPip — ensure they are number|null, never undefined
          if (updated.preMfeTickPip === undefined) {
            updated = { ...updated, preMfeTickPip: null };
          }
          if (updated.preMaeTickPip === undefined) {
            updated = { ...updated, preMaeTickPip: null };
          }

          // CRITICAL MIGRATION: accountName → accountId (UUID)
          if (!updated.accountId && updated.accountName) {
            const matchingAccounts = accountsList.filter(
              (a: any) => a.name === updated.accountName
            );
            if (matchingAccounts.length === 1) {
              updated = { ...updated, accountId: matchingAccounts[0].id };
              migrationReport.migrated++;
            } else {
              // 0 or multiple matches — skip assignment, log warning
              if (matchingAccounts.length > 1) {
                console.warn(
                  `[Migration] Ambiguous accountName "${updated.accountName}" matches ${matchingAccounts.length} accounts — skipping trade ${updated.id}`
                );
              }
              migrationReport.skipped++;
            }
          }
          // Remove deprecated accountName field after migration
          if ('accountName' in updated && updated.accountId) {
            const { accountName: _, ...rest } = updated;
            updated = rest;
          }
          
          // Calculate metrics once for all derived field reconciliation
          const metrics = calculateTradeMetrics(updated);
          
          // Migration 2: Reconcile savedRMultiple
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
            if (updated.savedReturnPercent === undefined || updated.savedReturnPercent === null) {
              updated = {
                ...updated,
                savedReturnPercent: 0,
              };
            }
          }

          // Migration 4: Backfill source + fingerprint for legacy trades.
          // Legacy trades default to 'manual'. Fingerprint is computed once
          // and persisted; never recomputed during deduplication comparison.
          if (!updated.source) {
            updated = { ...updated, source: 'manual' };
          }
          if (!updated.fingerprint) {
            updated = {
              ...updated,
              fingerprint: buildFingerprintForTrade(updated, updated.source),
            };
          }

          return updated;
          } catch (err) {
            console.error('[useTrades] Migration error for trade:', trade?.id, err);
            return { ...trade, preMfeTickPip: trade.preMfeTickPip ?? trade.mfeTickPip ?? null, preMaeTickPip: trade.preMaeTickPip ?? trade.maeTickPip ?? null };
          }
        }).filter(Boolean);

        // Log migration report
        if (migrationReport.migrated > 0 || migrationReport.skipped > 0) {
          console.log(`[useTrades] Account migration: ${migrationReport.migrated} trades migrated, ${migrationReport.skipped} skipped`);
        }

        setTrades(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));

        // Audit: surface any persisted date that isn't canonical ISO UTC
        const allDates: Array<string | null | undefined> = [];
        for (const t of migrated) {
          allDates.push(t.createdAt, t.updatedAt);
          if (Array.isArray(t.entries)) for (const e of t.entries) allDates.push(e?.datetime);
        }
        auditISOValues('useTrades', allDates);
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
    const source = data.source ?? 'manual';
    const tradeBase = {
      ...data,
      source,
      accountId: data.accountId,
    };
    const fingerprint =
      data.fingerprint ?? buildFingerprintForTrade(tradeBase as Trade, source);
    const newTrade: Trade = reconcileSavedFields({
      ...tradeBase,
      source,
      fingerprint,
      id: crypto.randomUUID(),
      userId: getCurrentUserId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    } as Trade);
    saveTrades([...trades, newTrade]);
    return newTrade;
  }, [trades, saveTrades]);

  const bulkAddTrades = useCallback((tradesData: TradeFormData[]): Trade[] => {
    const now = nowISO();
    const userId = getCurrentUserId();
    const newTrades: Trade[] = tradesData.map(data => {
      const source = data.source ?? 'manual';
      const fingerprint =
        data.fingerprint ?? buildFingerprintForTrade({ ...data, source } as Trade, source);
      return reconcileSavedFields({
        ...data,
        source,
        fingerprint,
        id: crypto.randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
      } as Trade);
    });
    saveTrades([...trades, ...newTrades]);
    return newTrades;
  }, [trades, saveTrades]);

  const updateTrade = useCallback((id: string, data: TradeFormData) => {
    const updated = trades.map(trade => {
      if (trade.id !== id) return trade;
      // Preserve original source — never flip imported→manual on edit
      const source = trade.source ?? data.source ?? 'manual';
      const next: Trade = reconcileSavedFields({
        ...trade,
        ...data,
        source,
        // accountBalanceSnapshot is a frozen point-in-time value captured at
        // trade creation. It must NEVER change on edit, even if the form
        // tries to send a new one. Return % is always anchored to the
        // original balance.
        accountBalanceSnapshot: trade.accountBalanceSnapshot,
        // Imported trades keep their stored fingerprint (immutable identity).
        // Manual trades recompute fingerprint from edited values.
        fingerprint:
          source === 'imported'
            ? trade.fingerprint
            : buildFingerprintForTrade({ ...trade, ...data, source } as Trade, 'manual'),
        updatedAt: nowISO(),
      } as Trade);
      return next;
    });
    saveTrades(updated);
  }, [trades, saveTrades]);

  // Bulk update multiple trades atomically (avoids stale closure issues with looped updateTrade)
  const bulkUpdateTrades = useCallback((updates: Map<string, Partial<TradeFormData>>) => {
    const now = nowISO();
    const updated = trades.map(trade => {
      const patch = updates.get(trade.id);
      if (!patch) return trade;
      const source = trade.source ?? 'manual';
      const merged = reconcileSavedFields({
        ...trade,
        ...patch,
        source,
        // Frozen snapshot — never overwritten on bulk edit
        accountBalanceSnapshot: trade.accountBalanceSnapshot,
        updatedAt: now,
      } as Trade);
      // Recompute fingerprint only for manual trades; imported keep stored identity
      merged.fingerprint =
        source === 'imported'
          ? trade.fingerprint
          : buildFingerprintForTrade(merged, 'manual');
      return merged;
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
    getTradeById,
  };
};
