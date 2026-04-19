import type { Account } from '@/contexts/AccountsContext';
import type { Challenge, StepRules, FundedRules, TargetValue, DrawdownValue } from '@/contexts/ChallengesContext';
import type { Trade } from '@/types/trade';
import { calculateTradeMetrics } from '@/types/trade';
import { localDayKey } from '@/lib/datetime';

export interface AccountStats {
  pnl: number;
  pnlPositive: boolean;
  currentBalance: number;
  tradingDays: number;
  profitTargetAmount: number | null;
  progressPct: number; // 0-100
  maxDrawdownAmount: number | null;
  currentDrawdown: number;
  drawdownPct: number; // 0-100
  consistencyTarget: number | null;
}

export function resolveTargetAmount(t: TargetValue | undefined, balance: number): number | null {
  if (!t || t.value == null) return null;
  return t.type === 'percent' ? (balance * t.value) / 100 : t.value;
}

export function resolveDrawdownAmount(d: DrawdownValue | undefined, balance: number): number | null {
  if (!d || d.value == null) return null;
  return d.mode === 'percent' ? (balance * d.value) / 100 : d.value;
}

function getActiveStepRules(challenge: Challenge, account: Account): StepRules | null {
  if (account.phase === 'funded') return null;
  if (account.step === '2' && challenge.rules.step2) return challenge.rules.step2;
  return challenge.rules.step1;
}

function getFundedRules(challenge: Challenge): FundedRules {
  return challenge.rules.funded;
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

/** Resolve the active drawdown spec for an account (funded or evaluation step). */
export function getActiveDrawdownSpec(
  challenge: Challenge,
  account: Account
): { type: 'static' | 'eod' | 'trailing'; mode: 'percent' | 'amount'; value: number | null } | null {
  if (account.phase === 'funded') {
    const f = challenge.rules.funded;
    const eff = f.sameAsStep1 ? challenge.rules.step1 : null;
    const dd = f.sameAsStep1 ? eff?.maxDrawdown : f.maxDrawdown;
    return dd ?? null;
  }
  const step = getActiveStepRules(challenge, account);
  return step?.maxDrawdown ?? null;
}

/**
 * Compute drawdown peak/floor/current using CLOSED trades only.
 * Returns peak balance, current drawdown amount (>= 0), and dynamic floor.
 */
function computeDrawdownState(
  startingBalance: number,
  closedTrades: { t: Trade; m: ReturnType<typeof calculateTradeMetrics> }[],
  ddType: 'static' | 'eod' | 'trailing',
  ddAmount: number | null
): { peak: number; currentDrawdown: number; floor: number | null; currentBalance: number } {
  const closedPnl = closedTrades.reduce((s, { m }) => s + (m.netPnl || 0), 0);
  const currentBalance = startingBalance + closedPnl;

  if (ddType === 'static') {
    const floor = ddAmount != null ? startingBalance - ddAmount : null;
    const currentDrawdown = Math.max(0, startingBalance - currentBalance);
    return { peak: startingBalance, currentDrawdown, floor, currentBalance };
  }

  if (ddType === 'trailing') {
    let running = startingBalance;
    let peak = startingBalance;
    for (const { m } of closedTrades) {
      running += m.netPnl || 0;
      if (running > peak) peak = running;
    }
    const floor = ddAmount != null ? peak - ddAmount : null;
    const currentDrawdown = Math.max(0, peak - currentBalance);
    return { peak, currentDrawdown, floor, currentBalance };
  }

  // EOD: peak walks day-by-day on completed trading days only (exclude today)
  // Uses LOCAL calendar so "today" + per-day buckets match the user's clock,
  // not a UTC slice (avoids off-by-one for users in non-UTC zones).
  const todayKey = localDayKey(new Date().toISOString());
  const dayPnl = new Map<string, number>();
  for (const { m } of closedTrades) {
    const day = localDayKey(m.closeDate);
    if (!day) continue;
    dayPnl.set(day, (dayPnl.get(day) || 0) + (m.netPnl || 0));
  }
  const sortedDays = [...dayPnl.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cumulative = 0;
  let peak = startingBalance;
  for (const [day, pnl] of sortedDays) {
    cumulative += pnl;
    if (day === todayKey) continue; // exclude today's intra-day from peak
    const eodBal = startingBalance + cumulative;
    if (eodBal > peak) peak = eodBal;
  }
  const floor = ddAmount != null ? peak - ddAmount : null;
  const currentDrawdown = Math.max(0, peak - currentBalance);
  return { peak, currentDrawdown, floor, currentBalance };
}

export function computeAccountStats(account: Account, challenge: Challenge | undefined, trades: Trade[]): AccountStats {
  const balance = challenge?.balanceAmount ?? account.startingBalance ?? 0;
  const accountTrades = trades
    .filter((t) => t.accountId === account.id)
    .map((t) => ({ t, m: calculateTradeMetrics(t) }))
    .sort((a, b) => new Date(a.m.closeDate || 0).getTime() - new Date(b.m.closeDate || 0).getTime());

  // CLOSED-only trades drive every balance / drawdown / day calculation.
  const closedTrades = accountTrades.filter(({ m }) => m.positionStatus === 'CLOSED');

  const pnl = closedTrades.reduce((sum, { m }) => sum + (m.netPnl || 0), 0);
  const currentBalance = balance + pnl;

  const dayKeys = new Set(
    closedTrades.map(({ m }) => localDayKey(m.closeDate)).filter(Boolean)
  );

  // Resolve target/drawdown/consistency from active rules
  let profitTargetAmount: number | null = null;
  let maxDrawdownAmount: number | null = null;
  let consistencyTarget: number | null = null;
  let ddType: 'static' | 'eod' | 'trailing' = 'static';

  if (challenge) {
    const ddSpec = getActiveDrawdownSpec(challenge, account);
    if (ddSpec) ddType = ddSpec.type;

    if (account.phase === 'funded') {
      const f = getFundedRules(challenge);
      const eff = f.sameAsStep1 ? challenge.rules.step1 : null;
      maxDrawdownAmount = resolveDrawdownAmount(
        f.sameAsStep1 ? eff?.maxDrawdown : f.maxDrawdown,
        balance
      );
      consistencyTarget = (f.sameAsStep1 ? eff?.consistency : f.consistency) ?? null;
    } else {
      const step = getActiveStepRules(challenge, account);
      if (step) {
        profitTargetAmount = resolveTargetAmount(step.profitTarget, balance);
        maxDrawdownAmount = resolveDrawdownAmount(step.maxDrawdown, balance);
        consistencyTarget = step.consistency ?? null;
      }
    }
  }

  const { currentDrawdown } = computeDrawdownState(balance, closedTrades, ddType, maxDrawdownAmount);

  const progressPct =
    profitTargetAmount && profitTargetAmount > 0 ? clamp((pnl / profitTargetAmount) * 100) : 0;
  const drawdownPct =
    maxDrawdownAmount && maxDrawdownAmount > 0
      ? clamp((currentDrawdown / maxDrawdownAmount) * 100)
      : 0;

  return {
    pnl,
    pnlPositive: pnl >= 0,
    currentBalance,
    tradingDays: dayKeys.size,
    profitTargetAmount,
    progressPct,
    maxDrawdownAmount,
    currentDrawdown,
    drawdownPct,
    consistencyTarget,
  };
}

/**
 * Compute the dynamic drawdown floor (red reference line) for charts.
 * - Static: startingBalance - ddAmount
 * - Trailing: closed-trade peak - ddAmount
 * - EOD: end-of-day peak (excluding today) - ddAmount
 */
export function computeDrawdownFloor(
  account: Account,
  challenge: Challenge | undefined,
  trades: Trade[]
): number | null {
  const balance = challenge?.balanceAmount ?? account.startingBalance ?? 0;
  if (!challenge) return null;
  const ddSpec = getActiveDrawdownSpec(challenge, account);
  if (!ddSpec) return null;
  const ddAmount = resolveDrawdownAmount(ddSpec, balance);
  if (ddAmount == null) return null;

  const closedTrades = trades
    .filter((t) => t.accountId === account.id)
    .map((t) => ({ t, m: calculateTradeMetrics(t) }))
    .filter(({ m }) => m.positionStatus === 'CLOSED')
    .sort((a, b) => new Date(a.m.closeDate || 0).getTime() - new Date(b.m.closeDate || 0).getTime());

  const { floor } = computeDrawdownState(balance, closedTrades, ddSpec.type, ddAmount);
}

/**
 * Compute the drawdown floor (red line) at every point in a chart series.
 * Mirrors `computeDrawdownState` rules exactly so chart visuals match account stats.
 *
 * - static   → constant `startingBalance - ddAmount`
 * - trailing → walk points; peak = max(peak, runningBalance); floor = peak - ddAmount
 * - eod      → peak walks day-by-day on completed (non-today) days only
 */
export function computeDrawdownFloorSeries(
  startingBalance: number,
  ddType: 'static' | 'eod' | 'trailing',
  ddAmount: number | null,
  points: { runningBalance: number; dayKey: string }[]
): (number | null)[] {
  if (ddAmount == null) return points.map(() => null);

  if (ddType === 'static') {
    const floor = startingBalance - ddAmount;
    return points.map(() => floor);
  }

  if (ddType === 'trailing') {
    let peak = startingBalance;
    return points.map((p) => {
      if (p.runningBalance > peak) peak = p.runningBalance;
      return peak - ddAmount;
    });
  }

  // EOD: peak only updates from completed (non-today) end-of-day balances.
  const todayKey = localDayKey(new Date().toISOString());
  // Find the final runningBalance per dayKey (in chronological order).
  const lastBalanceByDay = new Map<string, number>();
  for (const p of points) {
    if (!p.dayKey) continue;
    lastBalanceByDay.set(p.dayKey, p.runningBalance);
  }
  // Track which days are "completed" (not today and we've seen a later day).
  const dayKeysOrdered = [...lastBalanceByDay.keys()];
  let peak = startingBalance;
  // We update peak as soon as we move past a non-today day.
  const completedPeakAfterDay = new Map<string, number>();
  for (let i = 0; i < dayKeysOrdered.length; i++) {
    const dk = dayKeysOrdered[i];
    if (dk !== todayKey) {
      const eodBal = lastBalanceByDay.get(dk)!;
      if (eodBal > peak) peak = eodBal;
    }
    completedPeakAfterDay.set(dk, peak);
  }
  // For each point, floor uses the peak that was locked in by the END of its day
  // (matches `computeDrawdownState` which excludes today). For points within
  // today we use the prior peak (peak before today was processed).
  // Simpler equivalent: peak for a non-today day = peak after that day; for today = peak after the previous non-today day.
  let priorPeak = startingBalance;
  const peakBeforeDay = new Map<string, number>();
  for (const dk of dayKeysOrdered) {
    peakBeforeDay.set(dk, priorPeak);
    if (dk !== todayKey) {
      const eodBal = lastBalanceByDay.get(dk)!;
      if (eodBal > priorPeak) priorPeak = eodBal;
    }
  }
  return points.map((p) => {
    const dk = p.dayKey;
    if (!dk) return startingBalance - ddAmount;
    if (dk === todayKey) {
      return (peakBeforeDay.get(dk) ?? startingBalance) - ddAmount;
    }
    return (completedPeakAfterDay.get(dk) ?? startingBalance) - ddAmount;
  });
}

export function fmtUsd(n: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const fmt = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}$${fmt}`;
}

export function fmtUsdShort(n: number): string {
  const abs = Math.abs(n);
  const fmt = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${n < 0 ? '-' : ''}$${fmt}`;
}

export function stepBadge(account: Account): string {
  if (account.phase === 'funded' || account.step === 'funded') return 'FUNDED';
  if (account.step === '2') return 'STEP 2';
  return 'STEP 1';
}

export function formatStartedOn(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** Build a row object compatible with TableView's existing column shape. */
export function accountToRow(account: Account, challenge: Challenge | undefined, stats: AccountStats) {
  const firm = challenge?.firm || account.name;
  const stepLabel = stepBadge(account);
  const statusLabel =
    account.status === 'breached' ? 'Breached' : account.status === 'funded' ? 'Funded' : 'Active';
  const targetStr = stats.profitTargetAmount != null ? `${fmtUsdShort(stats.profitTargetAmount)}` : '—';
  const drawdownStr =
    stats.maxDrawdownAmount != null
      ? `${fmtUsdShort(stats.currentDrawdown)} / Max ${fmtUsdShort(stats.maxDrawdownAmount)}`
      : '—';
  return {
    id: account.id,
    firm,
    step: stepLabel,
    status: statusLabel,
    balance: fmtUsd(stats.currentBalance),
    pnl: `${stats.pnl >= 0 ? '+' : '-'}$${Math.abs(stats.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pnlPositive: stats.pnlPositive,
    target: targetStr,
    pnlBarValue: stats.progressPct,
    tradingDays: stats.tradingDays > 0 ? String(stats.tradingDays) : '—',
    drawdown: drawdownStr,
    consistency: stats.consistencyTarget != null ? `${stats.consistencyTarget}%` : '—',
  };
}
