import { TpSlRule } from '@/components/settings/TpSlSettings';

const STORAGE_KEY = 'trading-journal-tpsl-rules';

/** Migrate legacy rules */
const migrateRule = (raw: any): TpSlRule => {
  const rule: TpSlRule = {
    ...raw,
    accountIds: raw.accountIds || [],
  };
  if (rule.accountIds.length === 0 && raw.accountId) {
    rule.accountIds = [raw.accountId];
  }
  // Remove deprecated fields
  delete (rule as any).accountName;
  delete (rule as any).accountNames;
  return rule;
};

export function loadTpSlRules(): TpSlRule[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return (JSON.parse(stored) as any[]).map(migrateRule);
  } catch {
    return [];
  }
}

export function findMatchingTpSlRule(
  rules: TpSlRule[],
  accountId: string,
  symbol: string
): TpSlRule | null {
  return rules.find(r => r.accountIds.includes(accountId) && r.symbol === symbol) || null;
}

/**
 * Compute automatic TP/SL prices from a rule, entry price, direction, and tick size.
 */
export function computeAutoTpSl(
  rule: TpSlRule,
  entryPrice: number,
  direction: 'LONG' | 'SHORT',
  tickSize: number
): { tp: number | undefined; sl: number | undefined } {
  let tp: number | undefined;
  let sl: number | undefined;

  if (rule.profitTargetUnit === 'tick' && rule.profitTargetValue > 0) {
    tp = direction === 'LONG'
      ? entryPrice + (rule.profitTargetValue * tickSize)
      : entryPrice - (rule.profitTargetValue * tickSize);
  }
  if (rule.stopLossUnit === 'tick' && rule.stopLossValue > 0) {
    sl = direction === 'LONG'
      ? entryPrice - (rule.stopLossValue * tickSize)
      : entryPrice + (rule.stopLossValue * tickSize);
  }

  return { tp, sl };
}
