import type { Trade } from '@/types/trade';
import type { BacktestRow } from '@/lib/backtestStore';

const num = (v: any): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toISO = (v: any): string => {
  if (!v) return new Date().toISOString();
  const s = String(v);
  // accept yyyy-mm-dd or full ISO
  const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

/**
 * Synthesize a Trade from a backtest row so that all global analytics
 * (filters, charts, dashboard) can analyze backtest sessions exactly like
 * a normal trading account.
 */
export function synthesizeTradeFromBacktestRow(
  accountId: string,
  row: BacktestRow,
): Trade {
  const v = row.values || {};

  const direction = String(v.direction ?? 'Long').toLowerCase();
  const side: 'LONG' | 'SHORT' = direction === 'short' ? 'SHORT' : 'LONG';

  const entryPrice = num(v.entry_price) ?? 0;
  const exitPrice = num(v.exit_price) ?? entryPrice;
  const qty = num(v.quantity) ?? 1;
  const entryDateISO = toISO(v.date);
  const exitDateISO = toISO(v.exit_date ?? v.date);

  const stopLoss = num(v.stop_loss);
  const takeProfit = num(v.take_profit);

  const grossOverride = num(v.gross_pnl);
  const netOverride = num(v.net_pnl);
  const fees = num(v.fees) ?? 0;

  // Resolve manualGrossPnl: prefer explicit gross, then derive from net + fees,
  // and fall back to outcome-derived sign so analytics still classify correctly
  // when the user only provided R multiple / outcome.
  let manualGrossPnl: number | undefined;
  if (grossOverride !== undefined) manualGrossPnl = grossOverride;
  else if (netOverride !== undefined) manualGrossPnl = netOverride + fees;
  else if (entryPrice > 0 && exitPrice > 0) {
    const dirMul = side === 'SHORT' ? -1 : 1;
    manualGrossPnl = (exitPrice - entryPrice) * qty * dirMul;
  } else {
    const outcome = String(v.outcome ?? '').toLowerCase();
    const r = num(v.rr) ?? 0;
    if (outcome === 'win') manualGrossPnl = Math.abs(r || 1);
    else if (outcome === 'loss') manualGrossPnl = -Math.abs(r || 1);
    else manualGrossPnl = 0;
  }

  const tradeRisk =
    entryPrice > 0 && stopLoss !== undefined
      ? Math.abs(entryPrice - stopLoss) * qty
      : Math.abs(num(v.rr) ?? 0) > 0 && manualGrossPnl !== undefined
      ? Math.abs(manualGrossPnl / (num(v.rr) || 1))
      : 0;

  const isBE = String(v.outcome ?? '').toLowerCase() === 'be' ||
               String(v.break_even ?? '').toLowerCase() === 'yes';

  return {
    id: `bt:${row.id}`,
    symbol: String(v.symbol ?? '').toUpperCase() || 'BACKTEST',
    side,
    entries: [
      {
        id: `${row.id}-in`,
        type: side === 'LONG' ? 'BUY' : 'SELL',
        datetime: entryDateISO,
        quantity: qty,
        price: entryPrice || 1,
        charges: 0,
      },
      {
        id: `${row.id}-out`,
        type: side === 'LONG' ? 'SELL' : 'BUY',
        datetime: exitDateISO,
        quantity: qty,
        price: exitPrice || (entryPrice || 1),
        charges: 0,
      },
    ],
    tradeRisk,
    tradeTarget: takeProfit !== undefined && entryPrice > 0
      ? Math.abs(takeProfit - entryPrice) * qty
      : 0,
    accountId,
    tags: [],
    notes: '',
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
    stopLoss,
    takeProfit,
    manualGrossPnl,
    manualFees: fees,
    breakEven: isBE,
    preMfeTickPip: null,
    preMaeTickPip: null,
    savedRMultiple: num(v.rr),
    strategyId: typeof v.setup === 'string' && v.setup ? String(v.setup) : undefined,
  } as Trade;
}