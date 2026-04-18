import { useMemo, useState } from "react";
import { FileX } from "lucide-react";
import { useAccountsContext } from "@/contexts/AccountsContext";
import { useChallengesContext } from "@/contexts/ChallengesContext";
import { useTradesContext } from "@/contexts/TradesContext";
import { calculateTradeMetrics } from "@/types/trade";
import { formatBreachReason } from "@/lib/breachReason";

type BreachTab = "evaluation" | "funded";

interface BreachStats {
  count: number;
  topReasons: { reason: string; count: number; pct: number }[];
  avgDaysBeforeBreach: number | null;
  avgPnlBeforeBreach: number | null;
  mostCommonSize: string | null;
  mostCommonFirm: string | null;
}

function formatSizeBucket(balance: number): string {
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(balance % 1_000_000 === 0 ? 0 : 1)}M`;
  if (balance >= 1_000) return `${Math.round(balance / 1_000)}K`;
  return `$${balance}`;
}

function formatUsdSigned(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function modeOf<T extends string | number>(arr: T[]): T | null {
  if (!arr.length) return null;
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [k, v] of counts) if (v > bestN) { bestN = v; best = k; }
  return best;
}

export function BreachInsights() {
  const [activeTab, setActiveTab] = useState<BreachTab>("evaluation");
  const { accounts } = useAccountsContext();
  const { challenges } = useChallengesContext();
  const { trades } = useTradesContext();

  const { evaluation, funded } = useMemo(() => {
    const breached = accounts.filter(a => a.status === "breached");

    const compute = (subset: typeof breached): BreachStats => {
      const count = subset.length;

      // Top reasons
      const reasonCounts = new Map<string, number>();
      for (const a of subset) {
        const r = a.breachReason || "unknown";
        reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
      }
      const topReasons = Array.from(reasonCounts.entries())
        .map(([reason, c]) => ({ reason, count: c, pct: count > 0 ? Math.round((c / count) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Avg days before breach (createdAt → breachedAt)
      const days: number[] = [];
      for (const a of subset) {
        if (!a.breachedAt || !a.createdAt) continue;
        const start = new Date(a.createdAt).getTime();
        const end = new Date(a.breachedAt).getTime();
        if (isNaN(start) || isNaN(end) || end < start) continue;
        days.push(Math.floor((end - start) / (1000 * 60 * 60 * 24)));
      }
      const avgDaysBeforeBreach = days.length ? days.reduce((s, n) => s + n, 0) / days.length : null;

      // Avg P&L before breach (sum trade netPnl per account up to breachedAt)
      const pnls: number[] = [];
      for (const a of subset) {
        const cutoff = a.breachedAt ? new Date(a.breachedAt).getTime() : Infinity;
        const acctTrades = trades.filter(t => t.accountId === a.id);
        const pnl = acctTrades.reduce((sum, t) => {
          const m = calculateTradeMetrics(t);
          const closeTime = m.closeDate ? new Date(m.closeDate).getTime() : 0;
          if (closeTime && closeTime <= cutoff) return sum + (m.netPnl || 0);
          return sum;
        }, 0);
        pnls.push(pnl);
      }
      const avgPnlBeforeBreach = pnls.length ? pnls.reduce((s, n) => s + n, 0) / pnls.length : null;

      // Most common size (from challenge.balanceAmount, fallback startingBalance)
      const sizes = subset.map(a => {
        const c = challenges.find(ch => ch.challengeId === a.challengeId);
        return c?.balanceAmount ?? a.startingBalance;
      }).filter((n): n is number => typeof n === "number" && n > 0);
      const sizeMode = modeOf(sizes);
      const mostCommonSize = sizeMode != null ? formatSizeBucket(sizeMode) : null;

      // Most common firm
      const firms = subset.map(a => {
        const c = challenges.find(ch => ch.challengeId === a.challengeId);
        return c?.firm || a.name;
      }).filter((s): s is string => !!s);
      const mostCommonFirm = modeOf(firms);

      return { count, topReasons, avgDaysBeforeBreach, avgPnlBeforeBreach, mostCommonSize, mostCommonFirm };
    };

    return {
      evaluation: compute(breached.filter(a => a.phase !== "funded")),
      funded: compute(breached.filter(a => a.phase === "funded")),
    };
  }, [accounts, challenges, trades]);

  const stats = activeTab === "evaluation" ? evaluation : funded;

  const tabs: { key: BreachTab; label: string; count: number }[] = [
    { key: "evaluation", label: "Evaluation Breaches", count: evaluation.count },
    { key: "funded", label: "Funded Breaches", count: funded.count },
  ];

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Breach insights</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Understand why your accounts get breached and spot patterns.</p>
      </div>

      <div className="flex gap-0 border-b border-border mb-5 overflow-x-auto md:overflow-x-visible">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {stats.count === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-16 h-16 mb-4 relative">
            <div className="w-full h-full rounded-full bg-muted/60 flex items-center justify-center">
              <FileX className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">No breach data to show</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Try selecting different filters</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top breach reasons */}
          <div>
            <p className="text-[12px] font-semibold tracking-wider text-foreground/80 mb-3">TOP BREACH REASONS</p>
            <div className="space-y-3">
              {stats.topReasons.map((r) => (
                <div key={r.reason}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[14px] text-foreground">{formatBreachReason(r.reason)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {r.count} ({r.pct}%)
                    </span>
                  </div>
                  <div className="h-1 w-full bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive rounded-full transition-all"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correlated metrics */}
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-foreground/80 mb-3">CORRELATED METRICS</p>
            <div className="grid grid-cols-2 gap-3">
              <MetricBox
                label="Avg days before breach"
                value={stats.avgDaysBeforeBreach != null ? `${Math.round(stats.avgDaysBeforeBreach)}d` : "—"}
              />
              <MetricBox
                label="Avg P&L before breach"
                value={stats.avgPnlBeforeBreach != null ? formatUsdSigned(stats.avgPnlBeforeBreach) : "—"}
                valueClass={
                  stats.avgPnlBeforeBreach == null
                    ? ""
                    : stats.avgPnlBeforeBreach >= 0
                      ? "text-emerald-500"
                      : "text-destructive"
                }
              />
              <MetricBox label="Most common size" value={stats.mostCommonSize ?? "—"} />
              <MetricBox
                label="Most common firm"
                value={stats.mostCommonFirm ?? "—"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-semibold text-foreground ${valueClass}`}>{value}</p>
    </div>
  );
}
