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

export function computeAccountStats(account: Account, challenge: Challenge | undefined, trades: Trade[]): AccountStats {
  const balance = challenge?.balanceAmount ?? account.startingBalance ?? 0;
  const accountTrades = trades
    .filter((t) => t.accountId === account.id)
    .map((t) => ({ t, m: calculateTradeMetrics(t) }))
    .sort((a, b) => new Date(a.m.closeDate || 0).getTime() - new Date(b.m.closeDate || 0).getTime());

  const pnl = accountTrades.reduce((sum, { m }) => sum + (m.netPnl || 0), 0);
  const currentBalance = balance + pnl;

  const dayKeys = new Set(
    accountTrades.map(({ m }) => (m.closeDate ? m.closeDate.split('T')[0] : '')).filter(Boolean)
  );

  // Walking peak balance for drawdown
  let running = balance;
  let peak = balance;
  let maxDD = 0;
  for (const { m } of accountTrades) {
    running += m.netPnl || 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }
  const currentDrawdown = Math.max(0, peak - currentBalance);

  // Resolve target/drawdown/consistency from active rules
  let profitTargetAmount: number | null = null;
  let maxDrawdownAmount: number | null = null;
  let consistencyTarget: number | null = null;

  if (challenge) {
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
