import type { Trade, TradeFormData, TradeEntry } from '@/types/trade';

export type TradeSource = 'imported' | 'manual';

export interface FingerprintInput {
  source: TradeSource;
  accountId: string;
  symbol: string;
  entryTime: string; // ISO ('' if missing)
  exitTime: string;  // ISO ('' if open / missing)
  entryPrice: number;
  exitPrice: number;
  volume: number;
}

const normalize = (n: number | undefined | null): string =>
  Number(n ?? 0).toFixed(5);

export function buildTradeFingerprint(input: FingerprintInput): string {
  return [
    input.source,
    input.accountId,
    (input.symbol || '').trim().toUpperCase(),
    input.entryTime || '',
    input.exitTime || '',
    normalize(input.entryPrice),
    normalize(input.exitPrice),
    normalize(input.volume),
  ].join('_');
}

/**
 * Derive identity fields from a trade's entries for fingerprint construction.
 * Uses sorted-by-datetime entries; first = entry, last = exit.
 * For the volume we use total entry-side quantity (BUY for LONG, SELL for SHORT).
 */
export function extractIdentityFromTrade(
  trade: Trade | TradeFormData
): {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  volume: number;
} {
  const entries: TradeEntry[] = Array.isArray(trade.entries) ? trade.entries : [];
  const sorted = [...entries].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const side = trade.side || (first?.type === 'BUY' ? 'LONG' : 'SHORT');
  const entrySideType = side === 'LONG' ? 'BUY' : 'SELL';
  const exitSideType = side === 'LONG' ? 'SELL' : 'BUY';

  const entrySideEntries = entries.filter(e => e.type === entrySideType);
  const exitSideEntries = entries.filter(e => e.type === exitSideType);

  const totalEntryQty = entrySideEntries.reduce((s, e) => s + e.quantity, 0);
  const totalEntryCost = entrySideEntries.reduce(
    (s, e) => s + e.quantity * e.price,
    0
  );
  const totalExitQty = exitSideEntries.reduce((s, e) => s + e.quantity, 0);
  const totalExitValue = exitSideEntries.reduce(
    (s, e) => s + e.quantity * e.price,
    0
  );

  const avgEntryPrice = totalEntryQty > 0 ? totalEntryCost / totalEntryQty : 0;
  const avgExitPrice = totalExitQty > 0 ? totalExitValue / totalExitQty : 0;

  return {
    entryTime: first?.datetime || '',
    exitTime: sorted.length > 1 ? last?.datetime || '' : '',
    entryPrice: avgEntryPrice,
    exitPrice: avgExitPrice,
    volume: totalEntryQty,
  };
}

export function buildFingerprintForTrade(
  trade: Trade | TradeFormData,
  source: TradeSource
): string {
  const id = extractIdentityFromTrade(trade);
  return buildTradeFingerprint({
    source,
    accountId: trade.accountId,
    symbol: trade.symbol,
    ...id,
  });
}
