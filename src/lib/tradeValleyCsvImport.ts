import type { TradeFormData, TradeEntry } from '@/types/trade';
import { toISO } from '@/lib/datetime';
import { buildFingerprintForTrade } from '@/lib/tradeFingerprint';
import type { Strategy } from '@/contexts/StrategiesContext';
import type { Tag } from '@/contexts/TagsContext';
import type { Category } from '@/contexts/CategoriesContext';
import { STRATEGY_HEADER_SUFFIX, CATEGORY_HEADER_SUFFIX } from '@/lib/tradeValleyCsv';

export interface TradeValleyImportResult {
  success: boolean;
  tradesImported: number;
  duplicatesSkipped: number;
  rowsSkipped: number;
  errors: string[];
  importedSymbols: string[];
  strategiesCreated: number;
  checklistItemsCreated: number;
  categoriesCreated: number;
  tagsCreated: number;
}

export interface TradeValleyImportReconcilers {
  reconcileStrategiesForImport: (
    inputs: { name: string; checklistItems: string[] }[],
  ) => {
    map: Map<string, Strategy>;
    strategiesCreated: number;
    checklistItemsCreated: number;
  };
  reconcileCategoriesForImport: (names: string[]) => {
    map: Map<string, Category>;
    categoriesCreated: number;
  };
  reconcileTagsForImport: (
    inputs: { categoryId: string; name: string }[],
  ) => {
    map: Map<string, Tag>;
    tagsCreated: number;
  };
}

// ---------- CSV parsing (RFC 4180-ish) ----------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') { /* skip; \n handles row end */ }
      else cell += ch;
    }
  }
  // Trailing cell/row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.length > 0 && !(r.length === 1 && r[0] === ''));
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: string | undefined): boolean | undefined {
  if (!v || v.trim() === '') return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return undefined;
}

function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function importTradeValleyCsv(
  file: File,
  accountId: string,
  accountBalanceSnapshot: number,
  bulkAddTrades: (trades: TradeFormData[]) => void,
  reconcilers: TradeValleyImportReconcilers,
  existingFingerprints: Set<string> = new Set(),
): Promise<TradeValleyImportResult> {
  const errors: string[] = [];

  try {
    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length < 2) {
      return {
        success: false, tradesImported: 0, duplicatesSkipped: 0,
        rowsSkipped: 0, errors: ['File is empty or has no data rows'],
        importedSymbols: [],
        strategiesCreated: 0, checklistItemsCreated: 0,
        categoriesCreated: 0, tagsCreated: 0,
      };
    }

    const headers = rows[0].map(h => h.trim());
    const idx = (name: string): number => headers.indexOf(name);

    // ---------------- Pass 1: discover headers & values ----------------
    // Setup columns: header index → strategy name
    const setupHeaders: { colIdx: number; name: string }[] = [];
    // Category columns: header index → category name
    const categoryHeaders: { colIdx: number; name: string }[] = [];
    headers.forEach((h, i) => {
      if (h.endsWith(STRATEGY_HEADER_SUFFIX)) {
        const name = h.slice(0, -STRATEGY_HEADER_SUFFIX.length).trim();
        if (name) setupHeaders.push({ colIdx: i, name });
      } else if (h.endsWith(CATEGORY_HEADER_SUFFIX)) {
        const name = h.slice(0, -CATEGORY_HEADER_SUFFIX.length).trim();
        if (name) categoryHeaders.push({ colIdx: i, name });
      }
    });

    // Walk rows to gather every checklist item per setup and every tag per
    // category. Use case-insensitive dedupe but keep first-seen casing.
    const setupChecklists = new Map<string, { name: string; items: Map<string, string> }>();
    for (const sh of setupHeaders) {
      setupChecklists.set(sh.name.toLowerCase(), { name: sh.name, items: new Map() });
    }
    const categoryTags = new Map<string, { name: string; tagNames: Map<string, string> }>();
    for (const ch of categoryHeaders) {
      categoryTags.set(ch.name.toLowerCase(), { name: ch.name, tagNames: new Map() });
    }

    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      for (const sh of setupHeaders) {
        const cell = (cols[sh.colIdx] || '').trim();
        if (!cell) continue;
        const bucket = setupChecklists.get(sh.name.toLowerCase())!;
        for (const raw of cell.split(',')) {
          const item = raw.trim();
          if (!item) continue;
          const key = item.toLowerCase();
          if (!bucket.items.has(key)) bucket.items.set(key, item);
        }
      }
      for (const ch of categoryHeaders) {
        const cell = (cols[ch.colIdx] || '').trim();
        if (!cell) continue;
        const bucket = categoryTags.get(ch.name.toLowerCase())!;
        for (const raw of cell.split(',')) {
          const tagName = raw.trim();
          if (!tagName) continue;
          const key = tagName.toLowerCase();
          if (!bucket.tagNames.has(key)) bucket.tagNames.set(key, tagName);
        }
      }
    }

    // ---------------- Pass 2: reconcile (find-or-create) ----------------
    // Strategies (with merged checklist items).
    const strategyReconcileInputs = Array.from(setupChecklists.values()).map(
      v => ({ name: v.name, checklistItems: Array.from(v.items.values()) }),
    );
    const {
      map: strategyMap,
      strategiesCreated,
      checklistItemsCreated,
    } = reconcilers.reconcileStrategiesForImport(strategyReconcileInputs);

    // Categories.
    const categoryReconcileInputs = Array.from(categoryTags.values()).map(v => v.name);
    const { map: categoryMap, categoriesCreated } =
      reconcilers.reconcileCategoriesForImport(categoryReconcileInputs);

    // Tags (per category).
    const tagReconcileInputs: { categoryId: string; name: string }[] = [];
    for (const bucket of categoryTags.values()) {
      const cat = categoryMap.get(bucket.name.toLowerCase());
      if (!cat) continue; // shouldn't happen — defensive
      for (const tagName of bucket.tagNames.values()) {
        tagReconcileInputs.push({ categoryId: cat.id, name: tagName });
      }
    }
    const { map: tagMap, tagsCreated } =
      reconcilers.reconcileTagsForImport(tagReconcileInputs);

    // Per-column strategy/category resolution for trade insertion.
    const strategyByHeader = new Map<number, Strategy>();
    for (const sh of setupHeaders) {
      const s = strategyMap.get(sh.name.toLowerCase());
      if (s) strategyByHeader.set(sh.colIdx, s);
    }
    const categoryByHeader = new Map<number, Category>();
    for (const ch of categoryHeaders) {
      const c = categoryMap.get(ch.name.toLowerCase());
      if (c) categoryByHeader.set(ch.colIdx, c);
    }

    const seen = new Set<string>(existingFingerprints);
    const toInsert: TradeFormData[] = [];
    let duplicatesSkipped = 0;
    let rowsSkipped = 0;
    const importedSymbols = new Set<string>();

    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const get = (name: string): string => {
        const i = idx(name);
        return i >= 0 && i < cols.length ? cols[i] : '';
      };

      try {
        const symbol = get('Symbol').trim();
        const sideRaw = get('Side').trim().toUpperCase();
        const side: 'LONG' | 'SHORT' = sideRaw === 'SHORT' ? 'SHORT' : 'LONG';
        const openDt = get('Open Date/Time').trim();
        const closeDt = get('Close Date/Time').trim();
        const avgEntry = num(get('Avg Entry Price'));
        const avgExit = num(get('Avg Exit Price'));
        const quantity = num(get('Quantity'));
        const grossPnlCsv = num(get('Gross P&L'));
        const feesCsv = num(get('Fees'));
        const fees = feesCsv ?? 0;

        if (!symbol || !openDt || avgEntry === undefined || quantity === undefined || quantity <= 0) {
          rowsSkipped++;
          continue;
        }

        const entries: TradeEntry[] = [];
        // Entry leg
        const entryType: 'BUY' | 'SELL' = side === 'LONG' ? 'BUY' : 'SELL';
        const exitType: 'BUY' | 'SELL' = side === 'LONG' ? 'SELL' : 'BUY';
        entries.push({
          id: genId(),
          type: entryType,
          datetime: toISO(openDt),
          quantity,
          price: avgEntry,
          charges: fees,
        });
        // Exit leg (only if closed)
        if (closeDt && avgExit !== undefined) {
          entries.push({
            id: genId(),
            type: exitType,
            datetime: toISO(closeDt),
            quantity,
            price: avgExit,
            charges: 0,
          });
        }

        // Strategy + checklist resolution: first non-empty Strategy column wins
        let strategyId: string | undefined;
        let selectedChecklistItems: string[] | undefined;
        for (const [colIdx, strat] of strategyByHeader.entries()) {
          const cell = (cols[colIdx] || '').trim();
          if (!cell) continue;
          strategyId = strat.id;
          const itemTexts = cell.split(',').map(s => s.trim()).filter(Boolean);
          // Case-insensitive match against the (now-merged) checklist items,
          // preserving the canonical text stored on the strategy.
          const checklistByLower = new Map(
            strat.checklistItems.map(i => [i.toLowerCase(), i]),
          );
          selectedChecklistItems = itemTexts
            .map(t => checklistByLower.get(t.toLowerCase()))
            .filter((v): v is string => !!v);
          break;
        }

        // Tags: collect ids matching tag-name within each category column
        const tagIds: string[] = [];
        for (const [colIdx, cat] of categoryByHeader.entries()) {
          const cell = (cols[colIdx] || '').trim();
          if (!cell) continue;
          const names = cell.split(',').map(s => s.trim()).filter(Boolean);
          for (const name of names) {
            const t = tagMap.get(`${cat.id}::${name.toLowerCase()}`);
            if (t) tagIds.push(t.id);
          }
        }

        const trade: TradeFormData = {
          accountId,
          symbol,
          side,
          entries,
          tradeRisk: 0,
          tradeTarget: 0,
          strategyId,
          selectedChecklistItems,
          tags: tagIds,
          notes: '',
          stopLoss: num(get('Stop Loss')),
          takeProfit: num(get('Take Profit')),
          // Treat CSV Gross P&L / Fees as manual overrides so the final values
          // round-trip exactly, regardless of whether they were originally
          // auto-calculated or manually entered.
          manualGrossPnl: grossPnlCsv,
          manualFees: feesCsv,
          breakEven: bool(get('Break Even')),
          priceReachedFirst: (() => {
            const v = get('Price Reached First').trim();
            if (v === 'takeProfit' || v === 'stopLoss') return v;
            return undefined;
          })(),
          preMfePrice: num(get('MFE Price (pre-exit)')) ?? null,
          preMfeTickPip: num(get('MFE Ticks')) ?? null,
          preMaePrice: num(get('MAE Price (pre-exit)')) ?? null,
          preMaeTickPip: num(get('MAE Ticks')) ?? null,
          postMaxPrice: num(get('Highest Price (post-exit)')) ?? null,
          postMaxTickPip: num(get('Highest Ticks')) ?? null,
          postMinPrice: num(get('Lowest Price (post-exit)')) ?? null,
          postMinTickPip: num(get('Lowest Ticks')) ?? null,
          accountBalanceSnapshot,
          source: 'imported',
        };

        const fingerprint = buildFingerprintForTrade(trade, 'imported', {
          isOpen: entries.length === 1,
        });
        trade.fingerprint = fingerprint;

        if (seen.has(fingerprint)) {
          duplicatesSkipped++;
          continue;
        }
        seen.add(fingerprint);
        toInsert.push(trade);
        importedSymbols.add(symbol);
      } catch (err) {
        rowsSkipped++;
        errors.push(`Row ${r + 1}: ${err instanceof Error ? err.message : 'parse error'}`);
      }
    }

    if (toInsert.length > 0) bulkAddTrades(toInsert);

    return {
      success: true,
      tradesImported: toInsert.length,
      duplicatesSkipped,
      rowsSkipped,
      errors,
      importedSymbols: Array.from(importedSymbols),
      strategiesCreated,
      checklistItemsCreated,
      categoriesCreated,
      tagsCreated,
    };
  } catch (err) {
    return {
      success: false,
      tradesImported: 0,
      duplicatesSkipped: 0,
      rowsSkipped: 0,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
      importedSymbols: [],
      strategiesCreated: 0,
      checklistItemsCreated: 0,
      categoriesCreated: 0,
      tagsCreated: 0,
    };
  }
}
