import type { Account } from '@/contexts/AccountsContext';
import type { Challenge, StepRules, FundedRules, TargetValue, DrawdownValue } from '@/contexts/ChallengesContext';
import type { Trade } from '@/types/trade';
import { calculateTradeMetrics } from '@/types/trade';

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
function getActiveDrawdownSpec(
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
  const todayKey = new Date().toISOString().slice(0, 10);
  const dayPnl = new Map<string, number>();
  for (const { m } of closedTrades) {
    const day = m.closeDate ? m.closeDate.split('T')[0] : '';
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
    closedTrades.map(({ m }) => (m.closeDate ? m.closeDate.split('T')[0] : '')).filter(Boolean)
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
  return floor;
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
