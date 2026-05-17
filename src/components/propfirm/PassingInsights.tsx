import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { formatSizeBucket, accountTypeLabel } from "@/lib/propfirmDashboardStats";
import { usePropFirmFiltered } from "@/hooks/usePropFirmFiltered";

type InsightTab = "By firm" | "By account type" | "By account size" | "By strategy";

interface InsightItem {
  label: string;
  attempted: number;
  passed: number;
  percentage: number;
}

export function PassingInsights() {
  const [activeTab, setActiveTab] = useState<InsightTab>("By firm");
  const tabs: InsightTab[] = ["By firm", "By account type", "By account size", "By strategy"];

  const { accounts, challenges } = usePropFirmFiltered();

  const items = useMemo<InsightItem[]>(() => {
    const challengeMap = new Map(challenges.map(c => [c.challengeId, c]));
    // Eligible eval accounts: phase=evaluation, exclude funded step, exclude instant funded challenges
    const eligible = accounts.filter(a => {
      if (a.phase !== "evaluation") return false;
      if (a.step === "funded") return false;
      const c = a.challengeId ? challengeMap.get(a.challengeId) : undefined;
      if (c && c.steps === 0) return false;
      return true;
    });

    if (!eligible.length) return [];

    type Row = { attempted: number; passed: number };
    const groups = new Map<string, Row>();

    const bump = (key: string, isPassed: boolean) => {
      const cur = groups.get(key) ?? { attempted: 0, passed: 0 };
      cur.attempted += 1;
      if (isPassed) cur.passed += 1;
      groups.set(key, cur);
    };

    for (const a of eligible) {
      const isPassed = a.status === "completed";
      const c = a.challengeId ? challengeMap.get(a.challengeId) : undefined;

      if (activeTab === "By firm") {
        bump(c?.firm ?? a.name ?? "Unknown", isPassed);
      } else if (activeTab === "By account type") {
        bump(accountTypeLabel(c?.steps), isPassed);
      } else if (activeTab === "By account size") {
        const bal = c?.balanceAmount ?? a.startingBalance;
        bump(bal > 0 ? formatSizeBucket(bal) : "Unknown", isPassed);
      } else {
        // By strategy - flatten setups
        const setups = c?.setups && c.setups.length ? c.setups : ["No strategy"];
        for (const s of setups) bump(s, isPassed);
      }
    }

    return Array.from(groups.entries())
      .map(([label, r]) => ({
        label,
        attempted: r.attempted,
        passed: r.passed,
        percentage: r.attempted > 0 ? Math.round((r.passed / r.attempted) * 100) : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage || b.attempted - a.attempted);
  }, [accounts, challenges, activeTab]);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Passing insights</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Understand your passing rates across different dimensions</p>
      </div>
      <div className="flex gap-0 border-b border-border mb-4 overflow-x-auto md:overflow-x-visible">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-4">Passing rate = accounts passed / accounts attempted</p>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <BarChart3 className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No evaluation data yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Track challenges to see passing rates</p>
        </div>
      ) : (
        <div className="space-y-5">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <div className="text-sm font-medium text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Passed {item.passed} out of {item.attempted} {item.attempted === 1 ? "account" : "accounts"}
                  </div>
                </div>
                <div className="text-lg font-bold" style={{ color: item.percentage > 0 ? "#10b981" : "#6b7280" }}>{item.percentage}%</div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.percentage}%`, background: item.percentage > 0 ? "#10b981" : "#e5e7eb" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
