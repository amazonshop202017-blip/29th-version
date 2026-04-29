import type { Trade } from '@/types/trade';
import { calculateTradeMetrics } from '@/types/trade';
import type { Strategy } from '@/contexts/StrategiesContext';
import type { Tag } from '@/contexts/TagsContext';
import type { Category } from '@/contexts/CategoriesContext';

/**
 * TradeValley CSV export/import schema.
 *
 * Per-trade row containing only data the system cannot recalculate:
 *   - Symbol/Side/avg prices/quantity/datetimes/fees
 *   - Stop loss, take profit, risk, target
 *   - Manual P&L overrides, break-even, price-reached-first
 *   - MFE/MAE prices + ticks (pre + post exit)
 *   - One column per Strategy (Setup) — checked checklist items, comma-joined
 *   - One column per Tag Category — selected tag names, comma-joined
 *
 * Excluded: id/fingerprint/timestamps/source, account name/balance, notes/
 * comments/diary, screenshots, scale entries/exits, contractSize, tickSize,
 * computed metrics (P&L, return %, R-multiple, RRR, duration, ...).
 */

const FIXED_HEADERS = [
  'Symbol',
  'Side',
  'Open Date/Time',
  'Close Date/Time',
  'Avg Entry Price',
  'Avg Exit Price',
  'Quantity',
  'Stop Loss',
  'Take Profit',
  'Trade Risk',
  'Trade Target',
  'Gross P&L',
  'Fees',
  'Break Even',
  'Price Reached First',
  'MFE Price (pre-exit)',
  'MFE Ticks',
  'MAE Price (pre-exit)',
  'MAE Ticks',
  'Highest Price (post-exit)',
  'Highest Ticks',
  'Lowest Price (post-exit)',
  'Lowest Ticks',
] as const;

export const STRATEGY_HEADER_SUFFIX = ' (Setup)';
export const CATEGORY_HEADER_SUFFIX = ' (Tag Category)';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s === '') return '';
  if (/[",;\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return String(n);
}

function fmtBool(b: boolean | null | undefined): string {
  if (b === null || b === undefined) return '';
  return b ? 'true' : 'false';
}

export function exportTradesToCsv(
  trades: Trade[],
  strategies: Strategy[],
  tags: Tag[],
  categories: Category[],
): string {
  const strategyHeaders = strategies.map(s => `${s.name}${STRATEGY_HEADER_SUFFIX}`);
  const categoryHeaders = categories.map(c => `${c.name}${CATEGORY_HEADER_SUFFIX}`);
  const headers = [...FIXED_HEADERS, ...strategyHeaders, ...categoryHeaders];

  const tagById = new Map(tags.map(t => [t.id, t]));

  const rows: string[] = [headers.map(csvEscape).join(',')];

  for (const trade of trades) {
    const m = calculateTradeMetrics(trade);
    const computedCharges = (trade.entries || []).reduce((s, e) => s + (e.charges || 0), 0);
    const fees = trade.manualFees !== undefined ? trade.manualFees : computedCharges;

    const cells: string[] = [
      trade.symbol || '',
      trade.side || '',
      m.openDate || '',
      m.closeDate || '',
      fmtNum(m.avgEntryPrice),
      fmtNum(m.avgExitPrice),
      fmtNum(m.totalQuantity),
      fmtNum(fees),
      fmtNum(trade.stopLoss),
      fmtNum(trade.takeProfit),
      fmtNum(trade.tradeRisk),
      fmtNum(trade.tradeTarget),
      trade.manualGrossPnl !== undefined ? fmtNum(trade.manualGrossPnl) : '',
      trade.manualFees !== undefined ? fmtNum(trade.manualFees) : '',
      fmtBool(trade.breakEven),
      trade.priceReachedFirst || '',
      fmtNum(trade.preMfePrice),
      fmtNum(trade.preMfeTickPip),
      fmtNum(trade.preMaePrice),
      fmtNum(trade.preMaeTickPip),
      fmtNum(trade.postMaxPrice),
      fmtNum(trade.postMaxTickPip),
      fmtNum(trade.postMinPrice),
      fmtNum(trade.postMinTickPip),
    ];

    // Strategy (Setup) columns: only the matching strategy's column gets the
    // checked checklist item TEXTS, comma-joined. Others stay empty.
    for (const s of strategies) {
      if (trade.strategyId === s.id && trade.selectedChecklistItems?.length) {
        const checkedItems = trade.selectedChecklistItems
          .filter(item => s.checklistItems.includes(item));
        cells.push(checkedItems.join(', '));
      } else {
        cells.push('');
      }
    }

    // Category columns: selected tag NAMES that belong to that category.
    const tradeTagObjs = (trade.tags || [])
      .map(id => tagById.get(id))
      .filter((t): t is Tag => !!t);
    for (const c of categories) {
      const names = tradeTagObjs
        .filter(t => t.categoryId === c.id)
        .map(t => t.name);
      cells.push(names.join(', '));
    }

    rows.push(cells.map(csvEscape).join(','));
  }

  return rows.join('\n');
}

export function downloadTradesCsv(csv: string, filename: string): void {
  // Prepend BOM so Excel detects UTF-8 correctly.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
