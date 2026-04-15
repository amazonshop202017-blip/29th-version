import { useState } from "react";

type InsightTab = "By firm" | "By account type" | "By account size" | "By strategy";

const insightItems = [
  { label: 'Use "mffu"', desc: "Passed 1 out of 1 accounts", percentage: 100, color: "#10b981" },
  { label: 'Use "e8 markets"', desc: "Passed 0 out of 1 accounts", percentage: 0, color: "#e5e7eb" },
];

export function PassingInsights() {
  const [activeTab, setActiveTab] = useState<InsightTab>("By firm");
  const tabs: InsightTab[] = ["By firm", "By account type", "By account size", "By strategy"];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
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
      <div className="space-y-5">
        {insightItems.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <div className="text-lg font-bold" style={{ color: item.percentage > 0 ? "#10b981" : "#6b7280" }}>{item.percentage}%</div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.percentage}%`, background: item.percentage > 0 ? "#10b981" : "#e5e7eb" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
