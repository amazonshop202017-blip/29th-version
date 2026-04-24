import { TradeFormData, TradeEntry } from '@/types/trade';
import { loadFeeRules, findMatchingFeeRule, calculateFeeFromRule } from '@/lib/feeCalculation';
import { toISO } from '@/lib/datetime';
import { buildFingerprintForTrade } from '@/lib/tradeFingerprint';

export interface TradovateImportResult {
  success: boolean;
  tradesImported: number;
  duplicatesSkipped: number;
  rowsSkipped: number;
  errors: string[];
  importedSymbols: string[];
  symbolRulesAdded: number;
}

export interface SymbolRuleInput {
  symbol: string;
  tickSize: number;
  contractSize: number;
}

export type EnsureSymbolRules = (rules: SymbolRuleInput[]) => { added: number };

export interface SymbolMeta {
  tickSize: number;
  contractSize: number;
}

const DEFAULT_TICK_SIZE = 0.01;

// ----------------------------------------------------------------------------
// CSV parsing helpers (kept module-local — same approach as mt5Import)
// ----------------------------------------------------------------------------

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
  // Strip commas, currency symbols, spaces, and parentheses (negative)
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

// Parse Tradovate timestamp format: "MM/DD/YYYY HH:mm:ss"
// Treats input as user-local time and converts to ISO UTC via toISO().
function parseTradovateDateTime(input: string): string {
  const cleaned = (input ?? '').trim();
  if (!cleaned) throw new Error(`Invalid datetime: ${input}`);

  const [datePart, timePart] = cleaned.split(/\s+/);
  if (!datePart || !timePart) throw new Error(`Invalid datetime: ${input}`);

  const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(datePart);
  if (!dateMatch) throw new Error(`Invalid date part: ${datePart}`);
  const [, mmRaw, ddRaw, yyyy] = dateMatch;
  const mm = mmRaw.padStart(2, '0');
  const dd = ddRaw.padStart(2, '0');

  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timePart);
  if (!timeMatch) throw new Error(`Invalid time part: ${timePart}`);
  const [, hhRaw, miRaw, ssRaw] = timeMatch;
  const hh = hhRaw.padStart(2, '0');
  const mi = miRaw.padStart(2, '0');
  const ss = (ssRaw ?? '00').padStart(2, '0');

  const naive = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  const iso = toISO(naive);
  if (!iso) throw new Error(`Invalid datetime: ${input}`);
  return iso;
}

// ----------------------------------------------------------------------------
// Header detection (by name, order-agnostic)
// ----------------------------------------------------------------------------

interface ColumnIndexes {
  product: number;
  bought: number;
  sold: number;
  avgBuy: number;
  avgSell: number;
  pnl: number;
  boughtTs: number;
  soldTs: number;
  tickSize: number;
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function findHeaderRowIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]).map(c => normalizeHeader(stripCell(c)));
    if (cells.length < 5) continue;
    const hasProduct = cells.includes('product');
    const hasBoughtTs = cells.includes('bought timestamp');
    const hasSoldTs = cells.includes('sold timestamp');
    if (hasProduct && hasBoughtTs && hasSoldTs) return i;
  }
  return -1;
}

function findColumnIndexes(headers: string[]): ColumnIndexes {
  const norm = headers.map(h => normalizeHeader(h));
  const idxOf = (name: string) => norm.indexOf(name);

  // Tick size column may appear as "_tickSize" / "_tick size" / "_ticksize"
  const tickSizeIdx =
    norm.indexOf('_ticksize') !== -1
      ? norm.indexOf('_ticksize')
      : norm.indexOf('_tick size') !== -1
      ? norm.indexOf('_tick size')
      : norm.indexOf('_tick_size');

  const indexes: ColumnIndexes = {
    product: idxOf('product'),
    bought: idxOf('bought'),
    sold: idxOf('sold'),
    avgBuy: idxOf('avg. buy'),
    avgSell: idxOf('avg. sell'),
    pnl: idxOf('p/l'),
    boughtTs: idxOf('bought timestamp'),
    soldTs: idxOf('sold timestamp'),
    tickSize: tickSizeIdx,
  };

  const missing: string[] = [];
  if (indexes.product === -1) missing.push('Product');
  if (indexes.bought === -1) missing.push('Bought');
  if (indexes.sold === -1) missing.push('Sold');
  if (indexes.avgBuy === -1) missing.push('Avg. Buy');
  if (indexes.avgSell === -1) missing.push('Avg. Sell');
  if (indexes.pnl === -1) missing.push('P/L');
  if (indexes.boughtTs === -1) missing.push('Bought Timestamp');
  if (indexes.soldTs === -1) missing.push('Sold Timestamp');

  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }
  return indexes;
}

// ----------------------------------------------------------------------------
// CSV → Trades
// ----------------------------------------------------------------------------

export function parseTradovateCSVToTrades(
  csvContent: string,
  accountId: string,
  accountBalanceSnapshot: number,
  contractSizes?: Record<string, number>
): { trades: TradeFormData[]; skipped: number; symbolMeta: Map<string, SymbolMeta> } {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headerRowIndex = findHeaderRowIndex(lines);
  if (headerRowIndex === -1) {
    throw new Error('Could not locate Tradovate Positions header row in CSV.');
  }

  const headers = parseCSVLine(lines[headerRowIndex]).map(stripCell);
  const indexes = findColumnIndexes(headers);

  const trades: TradeFormData[] = [];
  const symbolMeta = new Map<string, SymbolMeta>();
  // Collect per-symbol contract size candidates across ALL rows for stable aggregation.
  const symbolContractCandidates = new Map<string, number[]>();
  // Track first-seen tick size per symbol (tick size is fixed per instrument).
  const symbolTickSize = new Map<string, number>();
  let skipped = 0;

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(stripCell);

    try {
      const symbol = values[indexes.product];
      const buyQty = parseNumber(values[indexes.bought]);
      const sellQty = parseNumber(values[indexes.sold]);
      const avgBuy = parseNumber(values[indexes.avgBuy]);
      const avgSell = parseNumber(values[indexes.avgSell]);
      const pnl = parseNumber(values[indexes.pnl]);
      const buyTimeRaw = values[indexes.boughtTs];
      const sellTimeRaw = values[indexes.soldTs];

      // STAGE 4 — basic validation
      if (
        !symbol ||
        !Number.isFinite(buyQty) || buyQty === 0 ||
        !Number.isFinite(sellQty) || sellQty === 0 ||
        !Number.isFinite(avgBuy) || avgBuy === 0 ||
        !Number.isFinite(avgSell) || avgSell === 0 ||
        !Number.isFinite(pnl) ||
        !buyTimeRaw || !sellTimeRaw
      ) {
        skipped++;
        continue;
      }

      // STAGE 5 — quantity normalization (closed portion only)
      const quantity = Math.min(buyQty, sellQty);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        skipped++;
        continue;
      }

      // STAGE 6 — timestamp parsing
      const buyTimeISO = parseTradovateDateTime(buyTimeRaw);
      const sellTimeISO = parseTradovateDateTime(sellTimeRaw);

      // STAGE 7 — direction (timestamp-only)
      const buyMs = new Date(buyTimeISO).getTime();
      const sellMs = new Date(sellTimeISO).getTime();
      if (!Number.isFinite(buyMs) || !Number.isFinite(sellMs) || buyMs === sellMs) {
        skipped++;
        continue;
      }

      let side: 'LONG' | 'SHORT';
      let entryTime: string;
      let exitTime: string;
      let entryPrice: number;
      let exitPrice: number;
      let entryType: 'BUY' | 'SELL';
      let exitType: 'BUY' | 'SELL';

      if (buyMs < sellMs) {
        side = 'LONG';
        entryTime = buyTimeISO;
        exitTime = sellTimeISO;
        entryPrice = avgBuy;
        exitPrice = avgSell;
        entryType = 'BUY';
        exitType = 'SELL';
      } else {
        side = 'SHORT';
        entryTime = sellTimeISO;
        exitTime = buyTimeISO;
        entryPrice = avgSell;
        exitPrice = avgBuy;
        entryType = 'SELL';
        exitType = 'BUY';
      }

      // STAGE 8 — entries (charges = 0; Tradovate fees not provided per row)
      const entries: TradeEntry[] = [
        {
          id: crypto.randomUUID(),
          type: entryType,
          datetime: entryTime,
          quantity,
          price: entryPrice,
          charges: 0,
        },
        {
          id: crypto.randomUUID(),
          type: exitType,
          datetime: exitTime,
          quantity,
          price: exitPrice,
          charges: 0,
        },
      ];

      // STAGE 9 — derived contract size from raw prices (per-row candidate)
      const denom = (avgSell - avgBuy) * quantity;
      let derivedContractSize: number | null = null;
      if (denom !== 0) {
        const cs = Math.abs(pnl / denom);
        if (Number.isFinite(cs) && cs > 0) derivedContractSize = cs;
      }

      // STAGE 9b — accumulate per-symbol meta candidates across ALL rows
      if (!symbolTickSize.has(symbol)) {
        const tickSizeRaw =
          indexes.tickSize !== -1 ? parseNumber(values[indexes.tickSize]) : NaN;
        const tickSize =
          Number.isFinite(tickSizeRaw) && tickSizeRaw > 0 ? tickSizeRaw : DEFAULT_TICK_SIZE;
        symbolTickSize.set(symbol, tickSize);
      }
      if (derivedContractSize !== null) {
        const arr = symbolContractCandidates.get(symbol);
        if (arr) arr.push(derivedContractSize);
        else symbolContractCandidates.set(symbol, [derivedContractSize]);
      }

      // Return % using account balance snapshot (parity with MT5)
      const calculatedReturnPercent =
        accountBalanceSnapshot > 0 ? (pnl / accountBalanceSnapshot) * 100 : 0;

      // STAGE 10 — final trade object
      const trade: TradeFormData = {
        symbol,
        side,
        entries,
        tradeRisk: 0,
        tradeTarget: 0,
        accountId,
        tags: [],
        notes: '',
        // Tradovate P/L is treated as both gross and net (no per-row fee data).
        manualGrossPnl: pnl,
        savedReturnPercent: calculatedReturnPercent,
        savedRMultiple: 0,
        accountBalanceSnapshot,
        contractSize: derivedContractSize ?? contractSizes?.[symbol] ?? 1,
        preMfeTickPip: null,
        preMaeTickPip: null,
        source: 'imported',
      };

      // STAGE 11 — fingerprint generated NOW and stored on the trade.
      trade.fingerprint = buildFingerprintForTrade(trade as any, 'imported');

      trades.push(trade);
    } catch {
      skipped++;
      continue;
    }
  }

  // STAGE 9c — finalize per-symbol contract size using median of candidates
  // (stable against rounding, partial fills, and noise), then snap to a clean
  // value when extremely close to an integer or simple decimal.
  for (const [symbol, tickSize] of symbolTickSize.entries()) {
    const candidates = symbolContractCandidates.get(symbol) ?? [];
    let contractSize = 1;
    if (candidates.length > 0) {
      const sorted = [...candidates].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      contractSize = stabilizeContractSize(median);
    }
    symbolMeta.set(symbol, { tickSize, contractSize });
  }

  return { trades, skipped, symbolMeta };
}

/**
 * Snap a derived contract size to a clean value when it's within tight
 * tolerance of an integer or a 0.5 step. Removes floating-point noise like
 * 500.0000000000107 or 99.99999999999982 → 500 / 100.
 */
function stabilizeContractSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const rounded = Math.round(value);
  if (rounded > 0 && Math.abs(value - rounded) / rounded < 1e-6) {
    return rounded;
  }
  const halfStep = Math.round(value * 2) / 2;
  if (halfStep > 0 && Math.abs(value - halfStep) / halfStep < 1e-6) {
    return halfStep;
  }
  // Fallback: keep up to 6 significant digits to suppress fp noise without distortion.
  return Number(value.toPrecision(6));
}

export async function importTradovateTrades(
  file: File,
  accountId: string,
  accountBalanceSnapshot: number,
  bulkAddTrades: (tradesData: TradeFormData[]) => void,
  contractSizes?: Record<string, number>,
  /**
   * Set of fingerprints already stored for this account (source = 'imported').
   * Comparison uses STORED fingerprints only — never recomputed during comparison.
   */
  existingFingerprints: Set<string> = new Set(),
  /**
   * Registers Symbol Tick/Pip rules for any symbols not already configured
   * for the importing account. Called BEFORE trades are inserted.
   */
  ensureSymbolRules?: EnsureSymbolRules
): Promise<TradovateImportResult> {
  const errors: string[] = [];

  try {
    const csvContent = await file.text();

    const { trades, skipped, symbolMeta } = parseTradovateCSVToTrades(
      csvContent,
      accountId,
      accountBalanceSnapshot,
      contractSizes
    );

    if (trades.length === 0) {
      return {
        success: false,
        tradesImported: 0,
        duplicatesSkipped: 0,
        rowsSkipped: skipped,
        errors: ['No valid trades found in the file'],
        importedSymbols: [],
        symbolRulesAdded: 0,
      };
    }

    // STAGE 12 — deduplication (against stored fingerprints + intra-file)
    const seen = new Set<string>(existingFingerprints);
    const toInsert: TradeFormData[] = [];
    let duplicatesSkipped = 0;

    for (const trade of trades) {
      const fp = trade.fingerprint;
      if (!fp) {
        duplicatesSkipped++;
        continue;
      }
      if (seen.has(fp)) {
        duplicatesSkipped++;
        continue;
      }
      seen.add(fp);
      toInsert.push(trade);
    }

    // STAGE 13a — register Symbol Tick/Pip rules BEFORE inserting trades.
    // Only for symbols whose trades will actually be inserted.
    let symbolRulesAdded = 0;
    const importedSymbols = Array.from(
      new Set(toInsert.map(t => t.symbol).filter(Boolean))
    );

    if (ensureSymbolRules && importedSymbols.length > 0) {
      const ruleInputs: SymbolRuleInput[] = importedSymbols
        .map(sym => {
          const meta = symbolMeta.get(sym);
          if (!meta) return null;
          return {
            symbol: sym,
            tickSize: meta.tickSize,
            contractSize: meta.contractSize,
          };
        })
        .filter((r): r is SymbolRuleInput => r !== null);

      if (ruleInputs.length > 0) {
        const res = ensureSymbolRules(ruleInputs);
        symbolRulesAdded = res.added;
      }
    }

    // STAGE 13b — insert trades AFTER rules are guaranteed to exist
    if (toInsert.length > 0) {
      bulkAddTrades(toInsert);
    }

    // STAGE 14 — result
    return {
      success: true,
      tradesImported: toInsert.length,
      duplicatesSkipped,
      rowsSkipped: skipped,
      errors: [],
      importedSymbols,
      symbolRulesAdded,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    errors.push(message);
    return {
      success: false,
      tradesImported: 0,
      duplicatesSkipped: 0,
      rowsSkipped: 0,
      errors,
      importedSymbols: [],
      symbolRulesAdded: 0,
    };
  }
}
