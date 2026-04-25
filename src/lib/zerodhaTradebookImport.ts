import { TradeFormData, TradeEntry, ScaleEntry } from '@/types/trade';
import { buildFingerprintForTrade } from '@/lib/tradeFingerprint';
import {
  loadFeeRules,
  findMatchingFeeRule,
  calculateFeeFromRule,
} from '@/lib/feeCalculation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZerodhaImportResult {
  success: boolean;
  tradesImported: number;
  duplicatesSkipped: number;
  rowsSkipped: number;
  errors: string[];
  importedSymbols: string[];
}

export interface ZerodhaImportOptions {
  applyFeeRules: boolean;
}

interface TradebookRow {
  symbol: string;
  iso: string;
  ms: number;
  qty: number;
  price: number;
  side: 'B' | 'S';
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function stripCell(s: string): string {
  return (s ?? '').replace(/^["']|["']$/g, '').trim();
}

function parseNumber(value: string | undefined): number {
  if (value === undefined || value === null) return NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;
  const isParenNeg = /^\(.*\)$/.test(raw);
  const cleaned = raw
    .replace(/[(),$\s]/g, '')
    .replace(/[^\d.\-+eE]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '+' || cleaned === '.') return NaN;
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return NaN;
  return isParenNeg ? -Math.abs(num) : num;
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Timestamp parsing — accepts "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD HH:mm:ss",
// optionally with timezone. Normalized to ISO UTC. Never falls back to locale.
// ---------------------------------------------------------------------------

function parseZerodhaTimestamp(input: string): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  const candidate = s.includes('T') ? s : s.replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(candidate)) return null;
  const d = new Date(candidate);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

interface ColumnIndexes {
  symbol: number;
  ts: number;
  side: number;
  qty: number;
  price: number;
}

function findHeaderRowIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]).map(c => normalizeHeader(stripCell(c)));
    if (cells.length < 4) continue;
    const has = (n: string) => cells.includes(n);
    if (
      has('symbol') &&
      has('order_execution_time') &&
      has('trade_type') &&
      has('quantity') &&
      has('price')
    ) {
      return i;
    }
  }
  return -1;
}

function findColumnIndexes(headers: string[]): ColumnIndexes {
  const norm = headers.map(h => normalizeHeader(h));
  const idx = (n: string) => norm.indexOf(n);

  const indexes: ColumnIndexes = {
    symbol: idx('symbol'),
    ts: idx('order_execution_time'),
    side: idx('trade_type'),
    qty: idx('quantity'),
    price: idx('price'),
  };

  const missing: string[] = [];
  if (indexes.symbol === -1) missing.push('symbol');
  if (indexes.ts === -1) missing.push('order_execution_time');
  if (indexes.side === -1) missing.push('trade_type');
  if (indexes.qty === -1) missing.push('quantity');
  if (indexes.price === -1) missing.push('price');

  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }
  return indexes;
}

// ---------------------------------------------------------------------------
// CSV → tradebook rows
// ---------------------------------------------------------------------------

export function parseZerodhaTradebookCSV(csvContent: string): {
  rows: TradebookRow[];
  skipped: number;
} {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headerRowIndex = findHeaderRowIndex(lines);
  if (headerRowIndex === -1) {
    throw new Error(
      'Could not locate Zerodha tradebook header row (expected symbol, order_execution_time, trade_type, quantity, price).'
    );
  }

  const headers = parseCSVLine(lines[headerRowIndex]).map(stripCell);
  const indexes = findColumnIndexes(headers);

  const rows: TradebookRow[] = [];
  let skipped = 0;

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(stripCell);
    try {
      const symbol = values[indexes.symbol];
      const tsRaw = values[indexes.ts];
      const sideRaw = (values[indexes.side] ?? '').trim().toUpperCase();
      const qty = parseNumber(values[indexes.qty]);
      const price = parseNumber(values[indexes.price]);

      if (!symbol) { skipped++; continue; }
      if (!Number.isFinite(qty) || qty === 0) { skipped++; continue; }
      if (!Number.isFinite(price)) { skipped++; continue; }
      if (!sideRaw) { skipped++; continue; }

      let side: 'B' | 'S';
      if (sideRaw === 'B' || sideRaw === 'BUY') side = 'B';
      else if (sideRaw === 'S' || sideRaw === 'SELL') side = 'S';
      else { skipped++; continue; }

      const iso = parseZerodhaTimestamp(tsRaw);
      if (!iso) { skipped++; continue; }

      rows.push({
        symbol,
        iso,
        ms: new Date(iso).getTime(),
        qty: Math.abs(qty),
        price,
        side,
      });
    } catch {
      skipped++;
      continue;
    }
  }

  return { rows, skipped };
}

// ---------------------------------------------------------------------------
// Position engine — mirrors tradovateFillsImport.reconstructTradesFromFills,
// minus symbol-rule gating; adds optional open-trade emission.
// ---------------------------------------------------------------------------

interface InternalFill {
  type: 'BUY' | 'SELL';
  iso: string;
  qty: number;
  price: number;
}

function sign(n: number): number {
  return n === 0 ? 0 : n > 0 ? 1 : -1;
}

export function reconstructZerodhaTrades(
  rows: TradebookRow[],
  accountId: string,
  accountBalanceSnapshot: number,
  options: ZerodhaImportOptions
): TradeFormData[] {
  const { importOpenTrades, applyFeeRules } = options;

  // Group by symbol, sort chronologically.
  const bySymbol = new Map<string, TradebookRow[]>();
  for (const r of rows) {
    const arr = bySymbol.get(r.symbol);
    if (arr) arr.push(r);
    else bySymbol.set(r.symbol, [r]);
  }
  for (const arr of bySymbol.values()) {
    arr.sort((a, b) => a.ms - b.ms);
  }

  const trades: TradeFormData[] = [];
  const feeRules = loadFeeRules();
  const symbols = [...bySymbol.keys()].sort();

  for (const symbol of symbols) {
    const symbolRows = bySymbol.get(symbol)!;

    let position = 0;
    let currentFills: InternalFill[] = [];
    let direction: 'LONG' | 'SHORT' | null = null;

    const finalize = (isOpen: boolean) => {
      if (currentFills.length === 0 || !direction) {
        currentFills = [];
        direction = null;
        return;
      }

      const entries: TradeEntry[] = currentFills.map(f => ({
        id: crypto.randomUUID(),
        type: f.type,
        datetime: f.iso,
        quantity: f.qty,
        price: f.price,
        charges: 0,
      }));

      const openType: 'BUY' | 'SELL' = direction === 'LONG' ? 'BUY' : 'SELL';
      const scaleEntries: ScaleEntry[] = [];
      const scaleExits: ScaleEntry[] = [];
      for (const f of currentFills) {
        const row: ScaleEntry = {
          id: crypto.randomUUID(),
          price: f.price,
          quantity: f.qty,
        };
        if (f.type === openType) scaleEntries.push(row);
        else scaleExits.push(row);
      }

      // Fee resolution — Zerodha tradebook has no commission column, so the
      // only way to attach fees is via a matching Fee Rule with the toggle ON.
      const matchedFeeRule = applyFeeRules
        ? findMatchingFeeRule(feeRules, accountId, symbol)
        : null;
      const ruleFee = matchedFeeRule
        ? calculateFeeFromRule(matchedFeeRule, entries, direction)
        : 0;

      const trade: TradeFormData = {
        symbol,
        side: direction,
        entries,
        scaleEntries: scaleEntries.length > 0 ? scaleEntries : undefined,
        scaleExits: scaleExits.length > 0 ? scaleExits : undefined,
        tradeRisk: 0,
        tradeTarget: 0,
        accountId,
        tags: [],
        notes: '',
        accountBalanceSnapshot,
        contractSize: 1,
        manualFees: ruleFee > 0 ? ruleFee : undefined,
        preMfeTickPip: null,
        preMaeTickPip: null,
        source: 'imported',
      };
      trade.fingerprint = buildFingerprintForTrade(trade as any, 'imported', {
        isOpen,
      });
      trades.push(trade);

      currentFills = [];
      direction = null;
    };

    const pushFill = (
      type: 'BUY' | 'SELL',
      iso: string,
      qty: number,
      price: number
    ) => {
      currentFills.push({ type, iso, qty, price });
    };

    for (const row of symbolRows) {
      const signedQty = row.side === 'B' ? row.qty : -row.qty;
      const prev = position;
      const next = prev + signedQty;

      if (prev === 0) {
        direction = row.side === 'B' ? 'LONG' : 'SHORT';
        pushFill(row.side === 'B' ? 'BUY' : 'SELL', row.iso, row.qty, row.price);
        position = next;
        if (next === 0) finalize(false);
        continue;
      }

      if (sign(next) === sign(prev) || next === 0) {
        pushFill(row.side === 'B' ? 'BUY' : 'SELL', row.iso, row.qty, row.price);
        position = next;
        if (next === 0) finalize(false);
      } else {
        // Reversal — close current direction, then open new one.
        const closingQty = Math.abs(prev);
        const openingQty = Math.abs(next);

        pushFill(
          row.side === 'B' ? 'BUY' : 'SELL',
          row.iso,
          closingQty,
          row.price
        );
        position = 0;
        finalize(false);

        direction = row.side === 'B' ? 'LONG' : 'SHORT';
        pushFill(
          row.side === 'B' ? 'BUY' : 'SELL',
          row.iso,
          openingQty,
          row.price
        );
        position = next;
      }
    }

    // Open position at end — emit only if user opted in.
    if (position !== 0) {
      if (importOpenTrades) {
        finalize(true);
      } else {
        currentFills = [];
        direction = null;
      }
    }
  }

  return trades;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function importZerodhaTradebook(
  file: File,
  accountId: string,
  accountBalanceSnapshot: number,
  bulkAddTrades: (tradesData: TradeFormData[]) => void,
  existingFingerprints: Set<string> = new Set(),
  options: ZerodhaImportOptions
): Promise<ZerodhaImportResult> {
  try {
    const csvContent = await file.text();
    const { rows, skipped } = parseZerodhaTradebookCSV(csvContent);

    if (rows.length === 0) {
      return {
        success: false,
        tradesImported: 0,
        duplicatesSkipped: 0,
        rowsSkipped: skipped,
        errors: ['No valid rows found in the file'],
        importedSymbols: [],
      };
    }

    const trades = reconstructZerodhaTrades(
      rows,
      accountId,
      accountBalanceSnapshot,
      options
    );

    const seen = new Set<string>(existingFingerprints);
    const toInsert: TradeFormData[] = [];
    let duplicatesSkipped = 0;

    for (const trade of trades) {
      const fp = trade.fingerprint;
      if (!fp) { duplicatesSkipped++; continue; }
      if (seen.has(fp)) { duplicatesSkipped++; continue; }
      seen.add(fp);
      toInsert.push(trade);
    }

    if (toInsert.length > 0) {
      bulkAddTrades(toInsert);
    }

    const importedSymbols = Array.from(
      new Set(toInsert.map(t => t.symbol).filter(Boolean))
    );

    return {
      success: true,
      tradesImported: toInsert.length,
      duplicatesSkipped,
      rowsSkipped: skipped,
      errors: [],
      importedSymbols,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      success: false,
      tradesImported: 0,
      duplicatesSkipped: 0,
      rowsSkipped: 0,
      errors: [message],
      importedSymbols: [],
    };
  }
}
