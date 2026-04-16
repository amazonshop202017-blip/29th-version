import { useState } from "react";
import { FileX } from "lucide-react";

type BreachTab = "Evaluation Breaches" | "Funded Breaches";

export function BreachInsights() {
  const [activeTab, setActiveTab] = useState<BreachTab>("Evaluation Breaches");
  const tabs: BreachTab[] = ["Evaluation Breaches", "Funded Breaches"];

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Breach insights</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Understand why your accounts get breached and spot patterns.</p>
      </div>
      <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto md:overflow-x-visible">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-16 h-16 mb-4 relative">
          <div className="w-full h-full rounded-full bg-muted/60 flex items-center justify-center">
            <FileX className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <div className="absolute bottom-0 right-0 w-5 h-5 bg-muted rounded-full flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="hsl(220,15%,65%)" strokeWidth="1.5" />
              <line x1="5" y1="3" x2="5" y2="6" stroke="hsl(220,15%,65%)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="5" cy="7.5" r="0.5" fill="hsl(220,15%,65%)" />
            </svg>
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">No breach data to show</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Try selecting different filters</p>
      </div>
    </div>
  );
}
