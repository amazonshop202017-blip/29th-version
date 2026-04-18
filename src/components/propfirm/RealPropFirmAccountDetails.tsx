import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronDown, Paperclip, BookOpen, CheckCircle2, RefreshCcw, AlertTriangle } from "lucide-react";
import { formatBreachReason, formatBreachDate } from "@/lib/breachReason";
import { TradesTableCard } from "@/components/trades/TradesTableCard";
import { useAccountsContext } from "@/contexts/AccountsContext";
import { useChallengesContext, type StepRules } from "@/contexts/ChallengesContext";
import { useAccountScopedFilteredTrades } from "@/hooks/useAccountScopedFilteredTrades";
import { calculateTradeMetrics } from "@/types/trade";
import {
  computeAccountStats,
  resolveTargetAmount,
  resolveDrawdownAmount,
  fmtUsd,
  formatStartedOn,
} from "@/lib/propFirmStats";

type Props = { accountId: string; onBack: () => void };
type ChartView = "Daily" | "Hourly" | "Per Trade";
type AccountTab = "STEP 1" | "STEP 2" | "FUNDING";

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-bold text-foreground">${Number(payload[0].value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
    );
  }
  return null;
}

function FundingItem({
  icon, label, sublabel, value, barValue, percentage, showCheck = true, threshold, thresholdLabel,
}: {
  icon?: React.ReactNode; label: string; sublabel?: string; value: string;
  barValue: number; percentage: string; showCheck?: boolean; threshold?: number; thresholdLabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, barValue));
  return (
    <div className="mb-4">
      <div className="flex items-start gap-2.5 mb-1.5">
        <div className="mt-0.5 shrink-0">
          {showCheck ? icon : (
            <div className="w-5 h-5 rounded-full border-2 border-primary/40 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-foreground">{value}</span>
              <div className="text-xs text-muted-foreground">{label}</div>
              {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
            </div>
            <span className="text-sm font-semibold text-foreground ml-4 shrink-0">{percentage}</span>
          </div>
          <div className="relative mt-2 h-1.5">
            <div className="absolute inset-0 bg-muted rounded-full" />
            <div className={`absolute inset-y-0 left-0 rounded-full ${clamped > 0 ? "bg-primary" : "bg-muted-foreground/20"}`} style={{ width: `${clamped}%` }} />
            {threshold !== undefined && (
              <div className="absolute" style={{ left: `${threshold}%`, top: "50%", transform: "translate(-50%, -50%)" }}>
                <div className="w-0.5 h-4 bg-foreground/55 rounded-full -translate-y-px" />
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-foreground/60 whitespace-nowrap">{thresholdLabel}</div>
              </div>
            )}
          </div>
          {threshold !== undefined && <div className="h-3" />}
        </div>
      </div>
    </div>
  );
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

export default function RealPropFirmAccountDetails({ accountId, onBack }: Props) {
  const { getAccountById } = useAccountsContext();
  const { getChallengeById } = useChallengesContext();
  

  const account = getAccountById(accountId);
  const challenge = account?.challengeId ? getChallengeById(account.challengeId) : undefined;

  // Account-scoped trades: locked to this accountId, with all global filters
  // (date range, symbols, outcomes, tags, etc.) applied EXCEPT the account filter.
  const accountTrades = useAccountScopedFilteredTrades(account?.id);

  const enriched = useMemo(
    () =>
      accountTrades
        .map((t) => ({ t, m: calculateTradeMetrics(t) }))
        .sort((a, b) => new Date(a.m.closeDate || 0).getTime() - new Date(b.m.closeDate || 0).getTime()),
    [accountTrades]
  );

  const dailyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const { m } of enriched) {
      const day = m.closeDate ? m.closeDate.split("T")[0] : "";
      if (!day) continue;
      map.set(day, (map.get(day) || 0) + (m.netPnl || 0));
    }
    return map;
  }, [enriched]);

  const tradeStats = useMemo(() => {
    const wins = enriched.filter(({ m }) => m.netPnl > 0);
    const losses = enriched.filter(({ m }) => m.netPnl < 0);
    const winRate = enriched.length ? (wins.length / enriched.length) * 100 : 0;
    const avgWin = wins.length ? wins.reduce((s, { m }) => s + m.netPnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, { m }) => s + m.netPnl, 0) / losses.length : 0;
    const dayValues = [...dailyTotals.values()];
    const bestDay = dayValues.length ? Math.max(...dayValues) : 0;
    const worstDay = dayValues.length ? Math.min(...dayValues) : 0;
    return { winRate, avgWin, avgLoss, bestDay, worstDay, hasTrades: enriched.length > 0 };
  }, [enriched, dailyTotals]);

  const stats = useMemo(() => {
    if (!account) return null;
    return computeAccountStats(account, challenge, accountTrades);
  }, [account, challenge, accountTrades]);

  const availableTabs: AccountTab[] = useMemo(() => {
    const base: AccountTab[] = ["STEP 1"];
    if (challenge?.steps === 2) base.push("STEP 2");
    base.push("FUNDING");
    return base;
  }, [challenge?.steps]);

  const defaultTab: AccountTab =
    account?.step === "funded" || account?.phase === "funded"
      ? "FUNDING"
      : account?.step === "2"
      ? "STEP 2"
      : "STEP 1";

  const [accountTab, setAccountTab] = useState<AccountTab>(defaultTab);
  const [chartView, setChartView] = useState<ChartView>("Daily");

  const selectedRules = useMemo(() => {
    if (!challenge || !account) return null;
    const balance = challenge.balanceAmount ?? account.startingBalance ?? 0;
    if (accountTab === "FUNDING") {
      const f = challenge.rules.funded;
      const eff: StepRules | null = f.sameAsStep1 ? challenge.rules.step1 : null;
      return {
        isFunded: true,
        balance,
        profitTarget: null as number | null,
        maxDailyLoss: resolveTargetAmount(f.sameAsStep1 ? eff?.maxDailyLoss : f.maxDailyLoss, balance),
        maxDrawdown: resolveDrawdownAmount(f.sameAsStep1 ? eff?.maxDrawdown : f.maxDrawdown, balance),
        consistency: (f.sameAsStep1 ? eff?.consistency : f.consistency) ?? null,
        minTradingDays: (f.sameAsStep1 ? eff?.minTradingDays : f.minTradingDays) ?? null,
        isUnlimited: eff?.isUnlimited ?? true,
        tradingPeriodDays: eff?.tradingPeriodDays ?? null,
      };
    }
    const step: StepRules | null = accountTab === "STEP 2" ? challenge.rules.step2 : challenge.rules.step1;
    if (!step) return null;
    return {
      isFunded: false,
      balance,
      profitTarget: resolveTargetAmount(step.profitTarget, balance),
      maxDailyLoss: resolveTargetAmount(step.maxDailyLoss, balance),
      maxDrawdown: resolveDrawdownAmount(step.maxDrawdown, balance),
      consistency: step.consistency ?? null,
      minTradingDays: step.minTradingDays,
      isUnlimited: step.isUnlimited,
      tradingPeriodDays: step.tradingPeriodDays,
    };
  }, [challenge, account, accountTab]);

  const balanceSeries = useMemo(() => {
    if (!account) return [] as { date: string; balance: number }[];
    const startBalance = account.startingBalance ?? 0;
    const start = { date: formatStartedOn(account.createdAt) || "Start", balance: startBalance };

    if (enriched.length === 0) return [start];

    const fmtDay = (iso: string) =>
      new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    const fmtHour = (iso: string) =>
      new Date(iso).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit" });
    const fmtTrade = (iso: string, idx: number) =>
      `#${idx + 1} ${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`;

    if (chartView === "Per Trade") {
      let running = startBalance;
      const series = [start];
      enriched.forEach(({ m }, i) => {
        running += m.netPnl || 0;
        series.push({ date: fmtTrade(m.closeDate || account.createdAt, i), balance: running });
      });
      return series;
    }

    const bucket = new Map<string, { label: string; pnl: number; ts: number }>();
    for (const { m } of enriched) {
      const iso = m.closeDate || account.createdAt;
      const d = new Date(iso);
      const key =
        chartView === "Hourly"
          ? `${d.toISOString().slice(0, 13)}`
          : d.toISOString().slice(0, 10);
      const label = chartView === "Hourly" ? fmtHour(iso) : fmtDay(iso);
      const existing = bucket.get(key);
      if (existing) existing.pnl += m.netPnl || 0;
      else bucket.set(key, { label, pnl: m.netPnl || 0, ts: d.getTime() });
    }
    const ordered = [...bucket.values()].sort((a, b) => a.ts - b.ts);
    let running = startBalance;
    const series = [start];
    for (const b of ordered) {
      running += b.pnl;
      series.push({ date: b.label, balance: running });
    }
    return series;
  }, [enriched, account?.startingBalance, account?.createdAt, chartView]);

  const today = new Date().toISOString().slice(0, 10);
  const dailyLoss = useMemo(() => {
    const todayPnl = enriched
      .filter(({ m }) => (m.closeDate || "").slice(0, 10) === today)
      .reduce((s, { m }) => s + (m.netPnl || 0), 0);
    return Math.max(0, -todayPnl);
  }, [enriched, today]);

  const consistency = useMemo(() => {
    const profitDays = [...dailyTotals.values()].filter((v) => v > 0);
    const totalProfit = profitDays.reduce((s, v) => s + v, 0);
    const bestDay = profitDays.length ? Math.max(...profitDays) : 0;
    const pct = totalProfit > 0 ? (bestDay / totalProfit) * 100 : 0;
    return { pct, totalProfit, bestDay };
  }, [dailyTotals]);

  if (!account) {
    return (
      <div className="space-y-5">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          Account not found.
        </div>
      </div>
    );
  }

  const balanceVals = balanceSeries.map((p) => p.balance);
  const minB = Math.min(...balanceVals);
  const maxB = Math.max(...balanceVals);
  const yDomain: [number, number] = balanceVals.length
    ? [Math.floor(minB * 0.98), Math.ceil(maxB * 1.02 || minB * 1.02 + 100)]
    : [0, 100];

  const startBalance = account.startingBalance ?? 0;
  const profitTargetLine =
    selectedRules && !selectedRules.isFunded && selectedRules.profitTarget != null
      ? startBalance + selectedRules.profitTarget
      : null;
  const drawdownFloorLine =
    selectedRules && selectedRules.maxDrawdown != null
      ? startBalance - selectedRules.maxDrawdown
      : null;

  const phasePill = account.phase === "funded" ? "Funded Account" : "Evaluation Account";
  const pnl = stats?.pnl ?? 0;
  const consistencyTarget = selectedRules?.consistency ?? stats?.consistencyTarget ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1">
              <h1 className="text-xl font-bold text-foreground">{account.name}</h1>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="ml-7">
            <span className="text-xs text-muted-foreground bg-muted rounded px-2 py-0.5 font-medium">
              {phasePill}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted/30 transition-colors">
            <Paperclip className="w-3.5 h-3.5" />Attach strategy
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <BookOpen className="w-3.5 h-3.5" />Journal
          </button>
        </div>
      </div>

      <div className="flex items-center gap-0 border-b border-border">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setAccountTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              accountTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {accountTab === tab && <RefreshCcw className="w-3.5 h-3.5 text-muted-foreground" />}
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Account balance over time</h3>
            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
              {(["Daily", "Hourly", "Per Trade"] as ChartView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setChartView(v)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    chartView === v
                      ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pfRealBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(250,80%,70%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(250,80%,70%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => Number(v).toLocaleString()} domain={yDomain} width={55} />
                <Tooltip content={<CustomTooltip />} />
                {profitTargetLine != null && (
                  <ReferenceLine
                    y={profitTargetLine}
                    stroke="hsl(145,60%,50%)"
                    strokeDasharray="5 4"
                    label={{ value: `Profit Target`, position: "right", fontSize: 10, fill: "hsl(145,60%,45%)" }}
                  />
                )}
                {drawdownFloorLine != null && (
                  <ReferenceLine
                    y={drawdownFloorLine}
                    stroke="hsl(0,70%,60%)"
                    strokeDasharray="5 4"
                    label={{ value: "Drawdown Floor", position: "right", fontSize: 10, fill: "hsl(0,65%,55%)" }}
                  />
                )}
                <Area type="monotone" dataKey="balance" stroke="hsl(250,80%,65%)" strokeWidth={2} fill="url(#pfRealBalanceGradient)" dot={false} activeDot={{ r: 4, fill: "hsl(250,80%,65%)" }} />
              </AreaChart>
            </ResponsiveContainer>
            {!tradeStats.hasTrades && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs text-muted-foreground bg-card/70 backdrop-blur px-3 py-1 rounded-md border border-border">
                  No trades yet
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Path to funding</h3>

          {!selectedRules?.isFunded && selectedRules?.profitTarget != null && (
            <FundingItem
              showCheck={false}
              label={`Target: ${fmtUsd(selectedRules.profitTarget)}`}
              value={`Profit: ${fmtUsd(pnl, { sign: true })}`}
              barValue={selectedRules.profitTarget > 0 ? clamp((pnl / selectedRules.profitTarget) * 100) : 0}
              percentage={`${(selectedRules.profitTarget > 0 ? clamp((pnl / selectedRules.profitTarget) * 100) : 0).toFixed(2)}%`}
            />
          )}

          {selectedRules?.isFunded && selectedRules.minTradingDays != null && (
            <FundingItem
              showCheck
              icon={
                (stats?.tradingDays ?? 0) >= (selectedRules.minTradingDays || 0) ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-primary/40 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                )
              }
              label={`Minimum trading days: ${selectedRules.minTradingDays}`}
              value={`Days: ${stats?.tradingDays ?? 0}`}
              barValue={selectedRules.minTradingDays > 0 ? clamp(((stats?.tradingDays ?? 0) / selectedRules.minTradingDays) * 100) : 0}
              percentage={`${selectedRules.minTradingDays > 0 ? Math.round(clamp(((stats?.tradingDays ?? 0) / selectedRules.minTradingDays) * 100)) : 0}%`}
            />
          )}

          {selectedRules?.maxDailyLoss != null && (
            <FundingItem
              showCheck
              icon={
                dailyLoss <= selectedRules.maxDailyLoss ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-rose-500/60 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  </div>
                )
              }
              label={`Maximum daily loss: ${fmtUsd(selectedRules.maxDailyLoss)}`}
              value={fmtUsd(dailyLoss)}
              barValue={selectedRules.maxDailyLoss > 0 ? clamp((dailyLoss / selectedRules.maxDailyLoss) * 100) : 0}
              percentage={`${selectedRules.maxDailyLoss > 0 ? Math.round(clamp((dailyLoss / selectedRules.maxDailyLoss) * 100)) : 0}%`}
            />
          )}

          {selectedRules?.maxDrawdown != null && (
            <FundingItem
              showCheck
              icon={
                (stats?.currentDrawdown ?? 0) <= (selectedRules.maxDrawdown || 0) ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-rose-500/60 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  </div>
                )
              }
              label={`Maximum Drawdown: ${fmtUsd(selectedRules.maxDrawdown)}`}
              sublabel={`Floor: ${fmtUsd(startBalance - selectedRules.maxDrawdown)}`}
              value={`Drawdown: ${fmtUsd(stats?.currentDrawdown ?? 0)}`}
              barValue={selectedRules.maxDrawdown > 0 ? clamp(((stats?.currentDrawdown ?? 0) / selectedRules.maxDrawdown) * 100) : 0}
              percentage={`${selectedRules.maxDrawdown > 0 ? Math.round(clamp(((stats?.currentDrawdown ?? 0) / selectedRules.maxDrawdown) * 100)) : 0}%`}
            />
          )}

          {consistencyTarget != null && (
            <FundingItem
              showCheck
              icon={
                consistency.pct <= consistencyTarget ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-primary/40 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                )
              }
              label={`Maximum Consistency: ${consistencyTarget}%`}
              sublabel={`Current Consistency: ${consistency.pct.toFixed(0)}%`}
              value={`Consistency: ${consistencyTarget}%`}
              barValue={clamp(consistency.pct)}
              percentage={`${consistency.pct.toFixed(0)}%`}
              threshold={consistencyTarget}
              thresholdLabel={`${consistencyTarget}%`}
            />
          )}

          <div className="border-t border-border mt-4 pt-4">
            <h4 className="text-sm font-bold text-foreground mb-3">Stats</h4>
            <div className="space-y-2">
              {(() => {
                const rows = [
                  { label: "Win rate", value: tradeStats.hasTrades ? `${tradeStats.winRate.toFixed(2)}%` : "—", color: "" },
                  { label: "Average win", value: tradeStats.avgWin > 0 ? `+${fmtUsd(tradeStats.avgWin)}` : "—", color: "text-emerald-500" },
                  { label: "Average loss", value: tradeStats.avgLoss < 0 ? `-${fmtUsd(Math.abs(tradeStats.avgLoss))}` : "—", color: "text-rose-500" },
                  { label: "Best day", value: tradeStats.bestDay > 0 ? `+${fmtUsd(tradeStats.bestDay)}` : "—", color: tradeStats.bestDay > 0 ? "text-emerald-500" : "" },
                  { label: "Worst day", value: tradeStats.worstDay < 0 ? `-${fmtUsd(Math.abs(tradeStats.worstDay))}` : "—", color: tradeStats.worstDay < 0 ? "text-rose-500" : "" },
                ];
                return rows.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <span className={`text-xs font-semibold ${stat.color || "text-foreground"}`}>{stat.value}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col h-[calc(100vh-10vh)] md:h-[calc(100vh-280px)] min-h-[400px]">
        <TradesTableCard
          trades={accountTrades}
          emptyState={{
            title: "No trades for this account yet",
            subtitle: "Trades placed on this account will appear here",
          }}
        />
      </div>
    </div>
  );
}
