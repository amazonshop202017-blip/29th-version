import { useState } from "react";

type FinanceTab = "By firm" | "By account type" | "By account size" | "Expenses";

const firmItems = [
  { name: 'Use "mffu"', color: "#22c55e", dotColor: "#22c55e", spent: 120, earned: 500, net: "+$380.", positive: true, barProgress: 100, percent: 89 },
  { name: 'Use "e8 markets"', color: "#6366f1", dotColor: "#6366f1", spent: 47, earned: 0, net: "-$47.", positive: false, barProgress: 8, percent: 11 },
];

function DonutChart() {
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
  const paths = firmItems.map((item, i) => {
    const degrees = (item.percent / 100) * 360;
    const start = currentAngle + gap / 2, end = currentAngle + degrees - gap / 2;
    currentAngle += degrees;
    return { path: arcPath(start, end, r, innerR), color: item.color, name: item.name, net: item.net, positive: item.positive, idx: i };
  });

  const hovered = hoveredIdx !== null ? firmItems[hoveredIdx] : null;

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
              <span className={`text-sm font-bold mt-0.5 ${hovered.positive ? "text-emerald-600" : "text-rose-500"}`}>{hovered.net}</span>
            </>
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground leading-tight">Net by firm</span>
              <span className="text-sm font-bold text-emerald-600 mt-0.5">+$333.</span>
            </>
          )}
        </div>
        {tooltip && hovered && (
          <div className="absolute pointer-events-none z-10 bg-white border border-border rounded-lg px-2.5 py-1.5 shadow-lg text-[11px] whitespace-nowrap -translate-x-1/2"
            style={{ left: tooltip.x, top: tooltip.y - 36 }}>
            <span className="font-medium text-foreground">{hovered.name}</span>
            <span className={`ml-2 font-semibold ${hovered.positive ? "text-emerald-600" : "text-rose-500"}`}>{hovered.net}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function FinanceBreakdown() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("By firm");
  const tabs: FinanceTab[] = ["By firm", "By account type", "By account size", "Expenses"];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3">Finance breakdown</h2>
      <div className="flex gap-0 border-b border-border mb-4 overflow-x-auto md:overflow-x-visible">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>
      <DonutChart />
      <div className="mt-5 space-y-4">
        {firmItems.map((item) => (
          <div key={item.name} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.dotColor }} />
                <span className="text-xs font-medium text-foreground">{item.name}</span>
              </div>
              <span className={`text-xs font-bold ${item.positive ? "text-emerald-600" : "text-rose-500"}`}>{item.net}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] mb-2 ml-4">
              <span>Spent: <span className="text-rose-500 font-medium">${item.spent}</span></span>
              <span>Earned: <span className="text-emerald-600 font-medium">${item.earned}</span></span>
            </div>
            <div className="ml-4 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${item.barProgress}%`, background: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
