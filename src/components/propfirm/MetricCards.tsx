import { useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, CircleDot, Trophy, Clock, Activity } from "lucide-react";
import { useAccountsContext } from "@/contexts/AccountsContext";
import { useTransactionsContext } from "@/contexts/TransactionsContext";
import { useTradesContext } from "@/contexts/TradesContext";
import { useChallengesContext } from "@/contexts/ChallengesContext";
import { calculateTradeMetrics } from "@/types/trade";
import { getNonIgnoredTxs } from "@/lib/propfirmDashboardStats";

const EXPENSE_CATS = new Set(["evaluation_fee", "activation_fee", "reset", "other_expense"]);
const INCOME_CATS = new Set(["payout", "refund", "commission", "other_income"]);

export function MetricCards() {
  const { accounts, getAllAccountsWithStats } = useAccountsContext();
  const { transactions } = useTransactionsContext();
  const { trades } = useTradesContext();
  const { getChallengeById } = useChallengesContext();

  const m = useMemo(() => {
    const stats = getAllAccountsWithStats();
    const byId = new Map(stats.map(s => [s.id, s]));

    // Funded
    const fundedAccts = accounts.filter(a => a.step === "funded" && a.status === "funded" && !a.isArchived);
    const fundedBalance = fundedAccts.reduce((s, a) => s + (byId.get(a.id)?.currentBalance ?? a.startingBalance), 0);

    // Evaluation
    const evalAccts = accounts.filter(a => a.phase === "evaluation" && a.status === "active" && !a.isArchived);
    const evalBalance = evalAccts.reduce((s, a) => s + (byId.get(a.id)?.currentBalance ?? a.startingBalance), 0);

    // Transactions
    const txs = getNonIgnoredTxs(transactions);
    const spent = txs
      .filter(t => t.type === "expense" && EXPENSE_CATS.has(t.category))
      .reduce((s, t) => s + t.amount, 0);
    const earned = txs
      .filter(t => t.type === "income" && INCOME_CATS.has(t.category))
      .reduce((s, t) => s + t.amount, 0);
    const net = earned - spent;
    const roi = spent > 0 ? (net / spent) * 100 : 0;

    // Pass rate = Passed ÷ Finished Attempts (completed + breached). Active/ongoing attempts are excluded.
    const finishedAttempts = accounts.filter(
      a => a.step !== "funded" && (a.status === "completed" || a.status === "breached")
    ).length;
    const passed = accounts.filter(a => a.status === "completed" && a.step !== "funded").length;
    const passRate = finishedAttempts > 0 ? (passed / finishedAttempts) * 100 : 0;
    const attempted = finishedAttempts;

    // Avg Days to Funded — multi-step aware
    const fundedAll = accounts.filter(a => a.step === "funded" && a.status === "funded");

    // Pre-group trades by accountId for performance
    const tradesByAccount = new Map<string, typeof trades>();
    for (const t of trades) {
      const list = tradesByAccount.get(t.accountId);
      if (list) list.push(t);
      else tradesByAccount.set(t.accountId, [t]);
    }

    const daysList: number[] = [];
    const tradesList: number[] = [];

    for (const fa of fundedAll) {
      if (!fa.challengeId) continue;
      const challenge = getChallengeById(fa.challengeId);
      if (!challenge || challenge.steps === 0) continue; // skip Instant
      if (!challenge.startDate) continue; // need real start

      const startTs = new Date(challenge.startDate).getTime();
      if (!isFinite(startTs)) continue;

      // Final evaluation step account
      const finalStep = challenge.steps === 2 ? "2" : "1";
      const stepAcct = accounts.find(
        x => x.challengeId === fa.challengeId && x.step === finalStep
      );
      if (!stepAcct) continue;

      // End date = latest closeDate among that step's trades
      const acctTrades = tradesByAccount.get(stepAcct.id) ?? [];
      const closeTimes = acctTrades
        .map(t => {
          const cd = calculateTradeMetrics(t).closeDate;
          return cd ? new Date(cd).getTime() : NaN;
        })
        .filter(ts => isFinite(ts));

      if (closeTimes.length === 0) continue; // SKIP — no fallback
      const endTs = Math.max(...closeTimes);

      const days = (endTs - startTs) / 86400000;
      if (isFinite(days) && days >= 0) daysList.push(days);

      tradesList.push(acctTrades.length);
    }
    const avgDays = daysList.length ? daysList.reduce((s, n) => s + n, 0) / daysList.length : 0;
    const avgTrades = tradesList.length ? tradesList.reduce((s, n) => s + n, 0) / tradesList.length : null;

    return {
      fundedBalance, fundedCount: fundedAccts.length,
      evalBalance, evalCount: evalAccts.length,
      spent, earned, net, roi,
      passRate, passed, attempted,
      avgDays, avgTrades, fundedTotal: fundedAll.length,
      avgDaysCount: daysList.length, avgTradesCount: tradesList.length,
    };
  }, [accounts, transactions, trades, getAllAccountsWithStats, getChallengeById]);

  const fmtUsd = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const netSign = m.net >= 0 ? "+" : "-";
  const netColor = m.net >= 0 ? "text-emerald-500" : "text-rose-500";
  const netSubColor = m.net >= 0 ? "text-emerald-500/80" : "text-rose-500/80";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <CircleDot className="w-3 h-3 text-emerald-500" />
                <span className="text-xs text-muted-foreground font-medium">Funded</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">{fmtUsd(m.fundedBalance)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {m.fundedCount} funded {m.fundedCount === 1 ? "account" : "accounts"}
              </div>
            </div>
            <div className="border-l border-border pl-3">
              <div className="flex items-center gap-1 mb-1">
                <CircleDot className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-muted-foreground font-medium">Evaluation</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">{fmtUsd(m.evalBalance)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {m.evalCount} eval {m.evalCount === 1 ? "account" : "accounts"}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-3">Total spent</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight">{fmtUsd(m.spent)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Evaluation fees &amp; resets</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-3">Total earned</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight">{fmtUsd(m.earned)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Payouts received</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-3">Net total</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className={`text-2xl font-bold tracking-tight ${netColor}`}>{netSign}{fmtUsd(m.net)}</div>
              <div className={`text-xs font-medium mt-0.5 ${netSubColor}`}>
                {m.net >= 0 ? "+" : ""}{m.roi.toFixed(1)}% ROI
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-3">Pass rate</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight">{m.passRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.passed} of {m.attempted} attempted</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-3">Avg days to funded</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {m.avgDaysCount > 0 ? `${Math.round(m.avgDays)}d` : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Across {m.avgDaysCount} funded</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-3">Avg trades to funded</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {m.avgTradesCount > 0 && m.avgTrades != null ? Math.round(m.avgTrades) : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Trades per funded account</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
