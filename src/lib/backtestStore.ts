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
  { id: 'date', label: 'Date', type: 'date', required: true, builtin: true },
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
  { id: 'notes', label: 'Notes', type: 'text', builtin: true },
];

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