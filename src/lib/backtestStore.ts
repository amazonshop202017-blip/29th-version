export type FieldType = 'text' | 'number' | 'date' | 'select';

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  builtin?: boolean;
}

export interface BacktestRow {
  id: string;
  createdAt: string;
  values: Record<string, string | number | null>;
}

const FIELDS_KEY = (id: string) => `tv-backtest-fields:${id}`;
const ROWS_KEY = (id: string) => `tv-backtest-trades:${id}`;

export const DEFAULT_FIELDS: FieldDef[] = [
  { id: 'date', label: 'Entry Date', type: 'date', required: true, builtin: true },
  { id: 'symbol', label: 'Symbol', type: 'text', required: true, builtin: true },
  {
    id: 'outcome',
    label: 'Outcome',
    type: 'select',
    required: true,
    builtin: true,
    options: ['Win', 'Loss', 'BE'],
  },
  { id: 'rr', label: 'R Multiple', type: 'number', builtin: true },
];

// All fields available in the Add Field library — mirrors the global "+ Add Trade" modal.
export const FIELD_CATALOG_GENERAL: FieldDef[] = [
  { id: 'date', label: 'Entry Date', type: 'date', required: true, builtin: true },
  { id: 'symbol', label: 'Symbol', type: 'text', required: true, builtin: true },
  { id: 'outcome', label: 'Outcome', type: 'select', required: true, builtin: true, options: ['Win', 'Loss', 'BE'] },
  { id: 'rr', label: 'R Multiple', type: 'number', builtin: true },
  { id: 'setup', label: 'Setup', type: 'text', builtin: true },
  { id: 'direction', label: 'Direction', type: 'select', builtin: true, options: ['Long', 'Short'] },
  { id: 'entry_price', label: 'Entry Price', type: 'number', builtin: true },
  { id: 'exit_price', label: 'Exit Price', type: 'number', builtin: true },
  { id: 'exit_date', label: 'Exit Date', type: 'date', builtin: true },
  { id: 'quantity', label: 'Quantity', type: 'number', builtin: true },
  { id: 'stop_loss', label: 'Stop Loss', type: 'number', builtin: true },
  { id: 'take_profit', label: 'Take Profit', type: 'number', builtin: true },
];

export const FIELD_CATALOG_ADVANCE: FieldDef[] = [
  { id: 'gross_pnl', label: 'Gross P/L', type: 'number', builtin: true },
  { id: 'net_pnl', label: 'Net P/L', type: 'number', builtin: true },
  { id: 'fees', label: 'Fees', type: 'number', builtin: true },
  { id: 'mfe', label: 'MFE', type: 'number', builtin: true },
  { id: 'mae', label: 'MAE', type: 'number', builtin: true },
  { id: 'highest_price', label: 'Highest Price', type: 'number', builtin: true },
  { id: 'lowest_price', label: 'Lowest Price', type: 'number', builtin: true },
  { id: 'break_even', label: 'Break Even', type: 'select', builtin: true, options: ['Yes', 'No'] },
];

export const FIELD_CATALOG: FieldDef[] = [...FIELD_CATALOG_GENERAL, ...FIELD_CATALOG_ADVANCE];

// Category-backed tag fields use a stable id prefix so we can detect them.
export const CATEGORY_FIELD_PREFIX = 'cat:';

export function categoryFieldId(categoryId: string) {
  return `${CATEGORY_FIELD_PREFIX}${categoryId}`;
}

export function buildCategoryField(
  category: { id: string; name: string },
  tagNames: string[],
): FieldDef {
  return {
    id: categoryFieldId(category.id),
    label: category.name,
    type: 'select',
    options: tagNames,
    builtin: false,
  };
}

export function loadFields(accountId: string): FieldDef[] {
  try {
    const raw = localStorage.getItem(FIELDS_KEY(accountId));
    if (!raw) return DEFAULT_FIELDS;
    const parsed = JSON.parse(raw) as FieldDef[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_FIELDS;
    return parsed;
  } catch {
    return DEFAULT_FIELDS;
  }
}

export function saveFields(accountId: string, fields: FieldDef[]) {
  localStorage.setItem(FIELDS_KEY(accountId), JSON.stringify(fields));
}

export function loadRows(accountId: string): BacktestRow[] {
  try {
    const raw = localStorage.getItem(ROWS_KEY(accountId));
    if (!raw) return [];
    return JSON.parse(raw) as BacktestRow[];
  } catch {
    return [];
  }
}

export function saveRows(accountId: string, rows: BacktestRow[]) {
  localStorage.setItem(ROWS_KEY(accountId), JSON.stringify(rows));
}

export function clearSession(accountId: string) {
  localStorage.removeItem(FIELDS_KEY(accountId));
  localStorage.removeItem(ROWS_KEY(accountId));
}

export function clearRows(accountId: string) {
  localStorage.removeItem(ROWS_KEY(accountId));
}

export interface BacktestStats {
  total: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;
  avgR: number;
  totalR: number;
}

export function computeStats(rows: BacktestRow[]): BacktestStats {
  let wins = 0, losses = 0, be = 0, totalR = 0, rCount = 0;
  for (const r of rows) {
    const outcome = String(r.values?.outcome ?? '').toLowerCase();
    if (outcome === 'win') wins++;
    else if (outcome === 'loss') losses++;
    else if (outcome === 'be') be++;
    const rr = Number(r.values?.rr);
    if (Number.isFinite(rr)) {
      totalR += rr;
      rCount++;
    }
  }
  const decided = wins + losses;
  return {
    total: rows.length,
    wins,
    losses,
    breakEvens: be,
    winRate: decided > 0 ? (wins / decided) * 100 : 0,
    avgR: rCount > 0 ? totalR / rCount : 0,
    totalR,
  };
}