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
  { id: 'direction', label: 'Direction', type: 'select', builtin: true, options: ['Long', 'Short'] },
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

// ---------------------------------------------------------------------------
// Field auto-derivation
// ---------------------------------------------------------------------------

type Vals = Record<string, string | number | null | undefined>;

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface DerivationRule {
  derivedId: string;
  sources: string[];
  compute: (v: Vals) => string | number | null;
}

export const DERIVATION_RULES: DerivationRule[] = [
  // R Multiple — full formula with stop loss
  {
    derivedId: 'rr',
    sources: ['entry_price', 'exit_price', 'stop_loss', 'direction'],
    compute: (v) => {
      const e = num(v.entry_price), x = num(v.exit_price), s = num(v.stop_loss);
      if (e === null || x === null || s === null) return null;
      const dir = String(v.direction ?? 'Long') === 'Short' ? -1 : 1;
      const risk = Math.abs(e - s);
      if (risk === 0) return null;
      return Number((((x - e) * dir) / risk).toFixed(4));
    },
  },
  // R Multiple — fallback (entry+exit only)
  {
    derivedId: 'rr',
    sources: ['entry_price', 'exit_price'],
    compute: (v) => {
      const e = num(v.entry_price), x = num(v.exit_price);
      if (e === null || x === null) return null;
      const dir = String(v.direction ?? 'Long') === 'Short' ? -1 : 1;
      return Number(((x - e) * dir).toFixed(4));
    },
  },
  // Outcome — needs direction to be meaningful
  {
    derivedId: 'outcome',
    sources: ['entry_price', 'exit_price', 'direction'],
    compute: (v) => {
      const e = num(v.entry_price), x = num(v.exit_price);
      if (e === null || x === null) return null;
      const dir = String(v.direction ?? 'Long') === 'Short' ? -1 : 1;
      const pnl = (x - e) * dir;
      if (pnl > 0) return 'Win';
      if (pnl < 0) return 'Loss';
      return 'BE';
    },
  },
  // Gross P/L
  {
    derivedId: 'gross_pnl',
    sources: ['entry_price', 'exit_price', 'quantity'],
    compute: (v) => {
      const e = num(v.entry_price), x = num(v.exit_price), q = num(v.quantity);
      if (e === null || x === null || q === null) return null;
      const dir = String(v.direction ?? 'Long') === 'Short' ? -1 : 1;
      return Number(((x - e) * q * dir).toFixed(4));
    },
  },
  // Net P/L
  {
    derivedId: 'net_pnl',
    sources: ['entry_price', 'exit_price', 'quantity', 'fees'],
    compute: (v) => {
      const e = num(v.entry_price), x = num(v.exit_price), q = num(v.quantity), f = num(v.fees);
      if (e === null || x === null || q === null || f === null) return null;
      const dir = String(v.direction ?? 'Long') === 'Short' ? -1 : 1;
      return Number(((x - e) * q * dir - f).toFixed(4));
    },
  },
];

/**
 * Returns the set of field ids that are fully covered by derivation rules
 * given the current field id list. A field is considered derivable if at
 * least one rule for it has all sources present (and the derived field
 * itself is not a source of another configured field).
 */
export function getDerivedFieldIds(fieldIds: string[]): string[] {
  const set = new Set(fieldIds);
  const out = new Set<string>();
  for (const rule of DERIVATION_RULES) {
    if (rule.sources.every(s => set.has(s))) {
      out.add(rule.derivedId);
    }
  }
  // never auto-remove a field that itself is a source for another rule we'd run
  return Array.from(out);
}

/**
 * Fill values with anything derivable from the configured fields. Manual
 * values already present are left untouched.
 */
export function applyDerivations(
  fieldIds: string[],
  values: Vals,
): Vals {
  const set = new Set(fieldIds);
  const out: Vals = { ...values };
  for (const rule of DERIVATION_RULES) {
    if (!rule.sources.every(s => set.has(s))) continue;
    // Skip if user explicitly re-added the derived field as an input
    if (set.has(rule.derivedId)) continue;
    const existing = out[rule.derivedId];
    if (existing !== undefined && existing !== null && existing !== '') continue;
    const v = rule.compute(out);
    if (v !== null && v !== undefined) out[rule.derivedId] = v;
  }
  return out;
}

export function fieldLabelFromCatalog(id: string): string | null {
  const found = FIELD_CATALOG.find(f => f.id === id);
  return found?.label ?? null;
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