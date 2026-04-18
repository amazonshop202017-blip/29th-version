import { Clock, CheckCircle2 } from "lucide-react";
import type { Account } from "@/contexts/AccountsContext";
import type { Challenge } from "@/contexts/ChallengesContext";
import {
  computeAccountStats,
  fmtUsd,
  formatStartedOn,
  resolveTargetAmount,
  resolveDrawdownAmount,
  stepBadge,
  type AccountStats,
} from "@/lib/propFirmStats";
import type { Trade } from "@/types/trade";

type AccountActions = {
  onViewDetails: () => void;
  onMarkAsFailed: () => void;
  onEditChallenge: () => void;
  onDeleteChallenge: () => void;
  progression?: { label: string; onClick: () => void };
  hideMarkAsFailed?: boolean;
};

type Props = {
  account: Account;
  challenge: Challenge;
  trades: Trade[];
  onSelect: () => void;
  ThreeDotMenu: (props: { actions: AccountActions; allowDelete?: boolean }) => JSX.Element;
  actions: AccountActions;
};

function ProgressRow({
  icon,
  label,
  sublabel,
  value,
  barValue,
  percentage,
  barColor = "bg-primary",
}: {
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  value: string;
  barValue: number;
  percentage: string;
  barColor?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="mt-0.5 shrink-0">{icon ?? <div className="w-5 h-5" />}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground">{value}</span>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
          </div>
          <span className="text-sm font-semibold text-foreground shrink-0">{percentage}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barValue}%` }} />
        </div>
      </div>
    </div>
  );
}

export function RealAccountCard({ account, challenge, trades, onSelect, ThreeDotMenu, actions }: Props) {
  const stats: AccountStats = computeAccountStats(account, challenge, trades);
  const firm = challenge.firm || account.name;
  const badge = stepBadge(account);
  const isFundedPhase = account.phase === "funded";

  const balance = challenge.balanceAmount ?? account.startingBalance;
  const step1 = challenge.rules.step1;

  // Funded effective rules (resolve sameAsStep1)
  const f = challenge.rules.funded;
  const fundedDailyLoss = f.sameAsStep1 ? step1.maxDailyLoss : f.maxDailyLoss;
  const fundedMinDays = f.sameAsStep1 ? step1.minTradingDays : (f.minTradingDays ?? null);

  // Daily loss (always step1's value for evaluation; funded uses funded rules)
  const dailyLossAmount = isFundedPhase
    ? resolveTargetAmount(fundedDailyLoss, balance)
    : resolveTargetAmount(step1.maxDailyLoss, balance);

  const tradingPeriodLabel = step1.isUnlimited
    ? "No time limit"
    : step1.tradingPeriodDays
    ? `${step1.tradingPeriodDays} days limit`
    : "No time limit";

  return (
    <div
      onClick={onSelect}
      className="bg-muted/40 rounded-xl border border-border p-4 w-full sm:w-[320px] cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-primary/20 active:scale-[0.98] active:shadow-sm"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-foreground tracking-tight leading-none">{firm}</span>
          <span className="text-[10px] font-semibold text-muted-foreground border border-border bg-card rounded px-1.5 py-0.5 uppercase tracking-wide">
            {badge}
          </span>
          {account.status === "breached" && (
            <span className="text-[10px] font-semibold text-rose-500 bg-rose-500/15 rounded px-1.5 py-0.5 uppercase tracking-wide">
              Breached
            </span>
          )}
        </div>
        <ThreeDotMenu actions={actions} allowDelete />
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="text-base font-bold text-foreground leading-tight">
          Balance: {fmtUsd(stats.currentBalance)}{" "}
          <span className={`text-sm font-semibold ${stats.pnlPositive ? "text-emerald-500" : "text-rose-500"}`}>
            ({stats.pnlPositive ? "+" : "-"}${Math.abs(stats.pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          </span>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 mt-0.5">Use "{firm}"</span>
      </div>

      <div className="bg-primary/10 rounded-lg px-3 py-2.5 flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Clock className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold text-primary leading-tight">{tradingPeriodLabel}</div>
          <div className="text-xs text-primary/70 mt-0.5">Started on {formatStartedOn(challenge.startDate || account.createdAt)}</div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-0.5">
        <span className="font-medium text-foreground">Account:</span> {account.name}
      </div>

      <div className="mt-1">
        {!isFundedPhase ? (
          <>
            {/* Profit Target */}
            <ProgressRow
              icon={
                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
              }
              label={
                stats.profitTargetAmount != null
                  ? `Target: ${fmtUsd(stats.profitTargetAmount)}`
                  : "Target: —"
              }
              value={`Profit: ${stats.pnl >= 0 ? "+" : "-"}$${Math.abs(stats.pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              barValue={stats.progressPct}
              percentage={`${stats.progressPct.toFixed(2)}%`}
              barColor="bg-primary"
            />
            {/* Max Daily Loss */}
            <ProgressRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              label={dailyLossAmount != null ? `Maximum daily loss: ${fmtUsd(dailyLossAmount)}` : "Maximum daily loss: —"}
              value={fmtUsd(0)}
              barValue={0}
              percentage="0%"
              barColor="bg-muted-foreground/30"
            />
            {/* Max Drawdown */}
            <ProgressRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              label={
                stats.maxDrawdownAmount != null
                  ? `Maximum Drawdown: ${fmtUsd(stats.maxDrawdownAmount)}`
                  : "Maximum Drawdown: —"
              }
              sublabel={
                stats.maxDrawdownAmount != null ? `Floor: ${fmtUsd(balance - stats.maxDrawdownAmount)}` : undefined
              }
              value={`Drawdown: ${fmtUsd(stats.currentDrawdown)}`}
              barValue={stats.drawdownPct}
              percentage={`${stats.drawdownPct.toFixed(2)}%`}
              barColor="bg-muted-foreground/30"
            />
          </>
        ) : (
          <>
            {/* Funded: Min trading days */}
            <ProgressRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              label={`Minimum trading days: ${fundedMinDays ?? "—"}`}
              value={`Days: ${stats.tradingDays}`}
              barValue={
                fundedMinDays && fundedMinDays > 0
                  ? Math.min(100, (stats.tradingDays / fundedMinDays) * 100)
                  : 0
              }
              percentage={
                fundedMinDays && fundedMinDays > 0
                  ? `${Math.min(100, (stats.tradingDays / fundedMinDays) * 100).toFixed(0)}%`
                  : "0%"
              }
              barColor="bg-primary"
            />
            <ProgressRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              label={dailyLossAmount != null ? `Maximum daily loss: ${fmtUsd(dailyLossAmount)}` : "Maximum daily loss: —"}
              value={fmtUsd(0)}
              barValue={0}
              percentage="0%"
              barColor="bg-muted-foreground/30"
            />
          </>
        )}
      </div>
    </div>
  );
}
