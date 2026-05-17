import { useMemo, useState } from "react";
import { PieChart } from "lucide-react";
import { CATEGORY_LABELS } from "@/contexts/TransactionsContext";
import { usePropFirmFiltered } from "@/hooks/usePropFirmFiltered";
import {
  getNonIgnoredTxs,
  groupTransactions,
  formatSizeBucket,
  accountTypeLabel,
  PROPFIRM_PALETTE,
} from "@/lib/propfirmDashboardStats";

type FinanceTab = "By firm" | "By account type" | "By account size" | "Expenses";

interface GroupItem {
  name: string;
  color: string;
  spent: number;
  earned: number;
  net: number;
  netLabel: string;
  positive: boolean;
  barProgress: number;
  percent: number;
}

function formatNet(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}.`;
}

function DonutChart({ items, totalNet }: { items: GroupItem[]; totalNet: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const cx = 90, cy = 90, r = 70, innerR = 50, gap = 4;

  function polarToCartesian(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(startAngle: number, endAngle: number, outerR: number, iR: number) {
    const s1 = polarToCartesian(startAngle, outerR), e1 = polarToCartesian(endAngle, outerR);
    const s2 = polarToCartesian(endAngle, iR), e2 = polarToCartesian(startAngle, iR);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return [`M ${s1.x} ${s1.y}`, `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y}`, `L ${s2.x} ${s2.y}`, `A ${iR} ${iR} 0 ${large} 0 ${e2.x} ${e2.y}`, "Z"].join(" ");
  }

  let currentAngle = 0;
  const paths = items.map((item, i) => {
    const degrees = (item.percent / 100) * 360;
    const start = currentAngle + gap / 2, end = currentAngle + Math.max(degrees - gap / 2, gap / 2 + 0.1);
    currentAngle += degrees;
    return { path: arcPath(start, end, r, innerR), color: item.color, name: item.name, netLabel: item.netLabel, positive: item.positive, idx: i };
  });

  const hovered = hoveredIdx !== null ? items[hoveredIdx] : null;
  const totalLabel = formatNet(totalNet);
  const totalPositive = totalNet >= 0;

  return (
    <div className="flex justify-center relative">
      <div className="relative" style={{ width: 180, height: 180 }} onMouseLeave={() => { setHoveredIdx(null); setTooltip(null); }}>
        <svg width={180} height={180} viewBox="0 0 180 180" style={{ overflow: "visible" }}>
          {paths.map((p) => (
            <path key={p.name} d={p.path} fill={p.color}
              opacity={hoveredIdx === null ? 1 : hoveredIdx === p.idx ? 1 : 0.4}
              style={{ cursor: "pointer", filter: hoveredIdx === p.idx ? "drop-shadow(0 2px 6px rgba(0,0,0,0.18))" : "none", transition: "opacity 0.15s, filter 0.15s" }}
              onMouseEnter={(e) => { setHoveredIdx(p.idx); const rect = (e.currentTarget.closest("svg") as SVGSVGElement).getBoundingClientRect(); setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 14 }); }}
              onMouseMove={(e) => { const rect = (e.currentTarget.closest("svg") as SVGSVGElement).getBoundingClientRect(); setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 14 }); }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered ? (
            <>
              <span className="text-[10px] text-muted-foreground leading-tight">{hovered.name}</span>
              <span className={`text-sm font-bold mt-0.5 ${hovered.positive ? "text-emerald-500" : "text-rose-500"}`}>{hovered.netLabel}</span>
            </>
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground leading-tight">Net total</span>
              <span className={`text-sm font-bold mt-0.5 ${totalPositive ? "text-emerald-500" : "text-rose-500"}`}>{totalLabel}</span>
            </>
          )}
        </div>
        {tooltip && hovered && (
          <div className="absolute pointer-events-none z-10 bg-card border border-border rounded-lg px-2.5 py-1.5 shadow-lg text-[11px] whitespace-nowrap -translate-x-1/2"
            style={{ left: tooltip.x, top: tooltip.y - 36 }}>
            <span className="font-medium text-foreground">{hovered.name}</span>
            <span className={`ml-2 font-semibold ${hovered.positive ? "text-emerald-500" : "text-rose-500"}`}>{hovered.netLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function FinanceBreakdown() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("By firm");
  const tabs: FinanceTab[] = ["By firm", "By account type", "By account size", "Expenses"];

  const { transactions, challenges } = usePropFirmFiltered();

  const items = useMemo<GroupItem[]>(() => {
    const txs = getNonIgnoredTxs(transactions);
    if (!txs.length) return [];

    const challengeMap = new Map(challenges.map(c => [c.challengeId, c]));

    let groups: Map<string, { spent: number; earned: number }>;
    if (activeTab === "By firm") {
      groups = groupTransactions(txs, t => {
        const c = t.challengeId ? challengeMap.get(t.challengeId) : undefined;
        return c?.firm ?? t.firm ?? "Unknown";
      });
    } else if (activeTab === "By account type") {
      groups = groupTransactions(txs, t => {
        const c = t.challengeId ? challengeMap.get(t.challengeId) : undefined;
        if (!c) return "Unknown";
        return accountTypeLabel(c.steps);
      });
    } else if (activeTab === "By account size") {
      groups = groupTransactions(txs, t => {
        const c = t.challengeId ? challengeMap.get(t.challengeId) : undefined;
        if (!c?.balanceAmount) return "Unknown";
        return formatSizeBucket(c.balanceAmount);
      });
    } else {
      // Expenses by category
      const expenseTxs = txs.filter(t => t.type === "expense");
      groups = groupTransactions(expenseTxs, t => CATEGORY_LABELS[t.category] ?? t.category);
    }

    const entries = Array.from(groups.entries()).map(([name, agg]) => ({
      name, spent: agg.spent, earned: agg.earned, net: agg.earned - agg.spent,
      volume: agg.spent + agg.earned,
    }));

    const globalMax = Math.max(1, ...entries.map(e => Math.max(e.spent, e.earned)));
    const totalVolume = entries.reduce((s, e) => s + e.volume, 0) || 1;

    return entries
      .sort((a, b) => b.volume - a.volume)
      .map((e, i) => ({
        name: e.name,
        color: PROPFIRM_PALETTE[i % PROPFIRM_PALETTE.length],
        spent: e.spent,
        earned: e.earned,
        net: e.net,
        netLabel: formatNet(e.net),
        positive: e.net >= 0,
        barProgress: (Math.max(e.spent, e.earned) / globalMax) * 100,
        percent: (e.volume / totalVolume) * 100,
      }));
  }, [transactions, challenges, activeTab]);

  const totalNet = useMemo(() => items.reduce((s, i) => s + i.net, 0), [items]);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3">Finance breakdown</h2>
      <div className="flex gap-0 border-b border-border mb-4 overflow-x-auto md:overflow-x-visible">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <PieChart className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No data to show</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Add transactions to see breakdown</p>
        </div>
      ) : (
        <>
          <DonutChart items={items} totalNet={totalNet} />
          <div className="mt-5 space-y-4">
            {items.map((item) => (
              <div key={item.name} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-xs font-medium text-foreground">{item.name}</span>
                  </div>
                  <span className={`text-xs font-bold ${item.positive ? "text-emerald-500" : "text-rose-500"}`}>{item.netLabel}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] mb-2 ml-4">
                  <span>Spent: <span className="text-rose-500 font-medium">${item.spent.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></span>
                  <span>Earned: <span className="text-emerald-500 font-medium">${item.earned.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></span>
                </div>
                <div className="ml-4 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${item.barProgress}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
