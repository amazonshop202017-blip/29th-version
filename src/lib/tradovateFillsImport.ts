import { TradeFormData, TradeEntry } from '@/types/trade';
import { buildFingerprintForTrade } from '@/lib/tradeFingerprint';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissingSymbolInfo {
  symbol: string;
  tickSize: number;
}

export interface TradovateFillsImportResult {
  success: boolean;
  tradesImported: number;
  duplicatesSkipped: number;
  rowsSkipped: number;
  errors: string[];
  importedSymbols: string[];
  missingSymbols: MissingSymbolInfo[];
}

interface FillRow {
  symbol: string;
  iso: string;       // ISO UTC
  ms: number;        // for sorting
  qty: number;       // > 0
  price: number;
  side: 'B' | 'S';
  commission: number;
  tickSize: number;  // CSV value if present, else default
}

const DEFAULT_TICK_SIZE = 0.01;

// ---------------------------------------------------------------------------
// CSV helpers (module-local, mirrors tradovateImport.ts)
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
// Strict timestamp parsing for fills: "YYYY-MM-DD HH:mm:ss.SSSZ"
// Returns ISO UTC or null. NEVER falls back to locale parsing.
// ---------------------------------------------------------------------------

function parseFillTimestamp(input: string): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  // Replace the first space (between date and time) with 'T'.
  const candidate = s.replace(' ', 'T');
  // Must look like a valid ISO; require Z or numeric offset.
  if (!/T\d{2}:\d{2}/.test(candidate)) return null;
  const d = new Date(candidate);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

interface ColumnIndexes {
  product: number;
  ts: number;
  qty: number;
  price: number;
  side: number;
  commission: number;
  tickSize: number;
}

function findHeaderRowIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]).map(c => normalizeHeader(stripCell(c)));
    if (cells.length < 4) continue;
    const hasProduct = cells.includes('product');
    const hasTs = cells.includes('_timestamp');
    const hasQty = cells.includes('_qty');
    const hasPrice = cells.includes('_price');
    if (hasProduct && hasTs && hasQty && hasPrice) return i;
  }
  return -1;
}

function findColumnIndexes(headers: string[]): ColumnIndexes {
  const norm = headers.map(h => normalizeHeader(h));
  const idx = (name: string) => norm.indexOf(name);

  // Tick size variants (optional)
  const tickSizeIdx = (() => {
    for (const n of ['_ticksize', '_tick size', '_tick_size']) {
      const i = norm.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  })();

  const indexes: ColumnIndexes = {
    product: idx('product'),
    // STRICT: only `_timestamp`, never plain `timestamp`.
    ts: idx('_timestamp'),
    qty: idx('_qty'),
    price: idx('_price'),
    side: (() => {
      for (const n of ['b/s', 'side']) {
        const i = norm.indexOf(n);
        if (i !== -1) return i;
      }
      return -1;
    })(),
    commission: norm.indexOf('commission'),
    tickSize: tickSizeIdx,
  };

  const missing: string[] = [];
  if (indexes.product === -1) missing.push('Product');
  if (indexes.ts === -1) missing.push('_timestamp');
  if (indexes.qty === -1) missing.push('_qty');
  if (indexes.price === -1) missing.push('_price');
  if (indexes.side === -1) missing.push('B/S');

  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }
  return indexes;
}

// ---------------------------------------------------------------------------
// CSV → fill rows
// ---------------------------------------------------------------------------

export function parseTradovateFillsCSV(csvContent: string): {
  rows: FillRow[];
  skipped: number;
} {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headerRowIndex = findHeaderRowIndex(lines);
  if (headerRowIndex === -1) {
    throw new Error('Could not locate Tradovate Fills header row in CSV (expected Product, _timestamp, _qty, _price).');
  }

  const headers = parseCSVLine(lines[headerRowIndex]).map(stripCell);
  const indexes = findColumnIndexes(headers);

  const rows: FillRow[] = [];
  let skipped = 0;

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(stripCell);
    try {
      const symbol = values[indexes.product];
      const tsRaw = values[indexes.ts];
      const qty = parseNumber(values[indexes.qty]);
      const price = parseNumber(values[indexes.price]);
      const sideRaw = (values[indexes.side] ?? '').trim().toUpperCase();
      const commissionRaw =
        indexes.commission !== -1 ? parseNumber(values[indexes.commission]) : 0;
      const tickSizeRaw =
        indexes.tickSize !== -1 ? parseNumber(values[indexes.tickSize]) : NaN;

      if (!symbol) { skipped++; continue; }
      if (!Number.isFinite(qty) || qty === 0) { skipped++; continue; }
      if (!Number.isFinite(price)) { skipped++; continue; }
      if (!sideRaw) { skipped++; continue; }

      let side: 'B' | 'S';
      if (sideRaw === 'B' || sideRaw === 'BUY') side = 'B';
      else if (sideRaw === 'S' || sideRaw === 'SELL') side = 'S';
      else { skipped++; continue; }

      const iso = parseFillTimestamp(tsRaw);
      if (!iso) { skipped++; continue; }

      const tickSize = Number.isFinite(tickSizeRaw) && tickSizeRaw > 0
        ? tickSizeRaw
        : DEFAULT_TICK_SIZE;

      rows.push({
        symbol,
        iso,
        ms: new Date(iso).getTime(),
        qty: Math.abs(qty),
        price,
        side,
        commission: Number.isFinite(commissionRaw) ? Math.abs(commissionRaw) : 0,
        tickSize,
      });
    } catch {
      skipped++;
      continue;
    }
  }

  return { rows, skipped };
}

// ---------------------------------------------------------------------------
// Position engine — reconstruct trades per symbol
// ---------------------------------------------------------------------------

interface InternalFill {
  type: 'BUY' | 'SELL';
  iso: string;
  qty: number;
  price: number;
  charges: number;
}

function sign(n: number): number {
  return n === 0 ? 0 : n > 0 ? 1 : -1;
}

export function reconstructTradesFromFills(
  rows: FillRow[],
  accountId: string,
  accountBalanceSnapshot: number,
  hasSymbolRule: (accountId: string, symbol: string) => boolean
): {
  trades: TradeFormData[];
  missingSymbols: MissingSymbolInfo[];
} {
  // Group by symbol, sort by timestamp
  const bySymbol = new Map<string, FillRow[]>();
  for (const r of rows) {
    const arr = bySymbol.get(r.symbol);
    if (arr) arr.push(r);
    else bySymbol.set(r.symbol, [r]);
  }
  for (const arr of bySymbol.values()) {
    arr.sort((a, b) => a.ms - b.ms);
  }

  const trades: TradeFormData[] = [];
  const missingMap = new Map<string, number>(); // symbol → tickSize for display

  // Process symbols in deterministic order
  const symbols = [...bySymbol.keys()].sort();

  for (const symbol of symbols) {
    const symbolRows = bySymbol.get(symbol)!;

    // Build trades for this symbol regardless of rule presence,
    // then drop them later if the rule is missing.
    const symbolTrades: TradeFormData[] = [];
    let position = 0;
    let currentFills: InternalFill[] = [];
    let direction: 'LONG' | 'SHORT' | null = null;

    const finalize = () => {
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
        charges: f.charges,
      }));

      const trade: TradeFormData = {
        symbol,
        side: direction,
        entries,
        tradeRisk: 0,
        tradeTarget: 0,
        accountId,
        tags: [],
        notes: '',
        accountBalanceSnapshot,
        // No manualGrossPnl; PnL is computed by calculateTradeMetrics
        // using the rule-based contractSize at render time.
        // Leave contractSize undefined so existing rule lookups govern PnL.
        preMfeTickPip: null,
        preMaeTickPip: null,
        source: 'imported',
      };
      trade.fingerprint = buildFingerprintForTrade(trade as any, 'imported');
      symbolTrades.push(trade);

      currentFills = [];
      direction = null;
    };

    const pushFill = (type: 'BUY' | 'SELL', iso: string, qty: number, price: number, charges: number) => {
      currentFills.push({ type, iso, qty, price, charges });
    };

    for (const row of symbolRows) {
      const signedQty = row.side === 'B' ? row.qty : -row.qty;
      const prev = position;
      const next = prev + signedQty;

      if (prev === 0) {
        // Trade start
        direction = row.side === 'B' ? 'LONG' : 'SHORT';
        pushFill(row.side === 'B' ? 'BUY' : 'SELL', row.iso, row.qty, row.price, row.commission);
        position = next;
        if (next === 0) {
          // Degenerate (zero-qty after parse impossible); finalize anyway
          finalize();
        }
        continue;
      }

      // prev !== 0
      if (sign(next) === sign(prev) || next === 0) {
        // Same direction add, partial close, or full close
        pushFill(row.side === 'B' ? 'BUY' : 'SELL', row.iso, row.qty, row.price, row.commission);
        position = next;
        if (next === 0) finalize();
      } else {
        // Reversal: split into closing portion + opening portion
        const closingQty = Math.abs(prev);
        const openingQty = Math.abs(next);

        // Closing portion — opposite of current direction; commission attributed here
        pushFill(
          row.side === 'B' ? 'BUY' : 'SELL',
          row.iso,
          closingQty,
          row.price,
          row.commission
        );
        position = 0;
        finalize();

        // Opening portion — starts a new trade in the new direction
        direction = row.side === 'B' ? 'LONG' : 'SHORT';
        pushFill(
          row.side === 'B' ? 'BUY' : 'SELL',
          row.iso,
          openingQty,
          row.price,
          0 // commission already attributed to the closing fill
        );
        position = next;
      }
    }

    // Open position at end → discard
    // (position !== 0 means trade was never fully closed; do not insert.)
    if (position !== 0) {
      currentFills = [];
      direction = null;
    }

    // Symbol-level rule check — drop all reconstructed trades if missing.
    if (!hasSymbolRule(accountId, symbol)) {
      // Use the first row's tickSize for display
      const tick = symbolRows[0]?.tickSize ?? DEFAULT_TICK_SIZE;
      missingMap.set(symbol, tick);
      continue;
    }

    trades.push(...symbolTrades);
  }

  const missingSymbols: MissingSymbolInfo[] = [...missingMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, tickSize]) => ({ symbol, tickSize }));

  return { trades, missingSymbols };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function importTradovateFills(
  file: File,
  accountId: string,
  accountBalanceSnapshot: number,
  bulkAddTrades: (tradesData: TradeFormData[]) => void,
  existingFingerprints: Set<string> = new Set(),
  hasSymbolRule: (accountId: string, symbol: string) => boolean
): Promise<TradovateFillsImportResult> {
  try {
    const csvContent = await file.text();
    const { rows, skipped } = parseTradovateFillsCSV(csvContent);

    if (rows.length === 0) {
      return {
        success: false,
        tradesImported: 0,
        duplicatesSkipped: 0,
        rowsSkipped: skipped,
        errors: ['No valid fills found in the file'],
        importedSymbols: [],
        missingSymbols: [],
      };
    }

    const { trades, missingSymbols } = reconstructTradesFromFills(
      rows,
      accountId,
      accountBalanceSnapshot,
      hasSymbolRule
    );

    // Dedup against stored fingerprints + intra-file
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
      missingSymbols,
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
      missingSymbols: [],
    };
  }
}
