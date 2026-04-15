import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Clock, CheckCircle2, LayoutList, LayoutGrid } from "lucide-react";

type AccountTab = "Evaluations" | "Funded" | "Breached";
type ViewMode = "list" | "grid";

const accountTabs: { label: AccountTab; count: number }[] = [
  { label: "Evaluations", count: 1 },
  { label: "Funded", count: 1 },
  { label: "Breached", count: 0 },
];

const evaluationAccounts = [
  { id: "e8-eval", firm: "e8", step: "Step 1", status: "Active", balance: "$10,486.03", pnl: "+$486.03", pnlPositive: true, target: "8%", pnlBarValue: 60, tradingDays: "—", drawdown: "$0 / Max $800", consistency: "—" },
];

const fundedAccounts = [
  { id: "mffu-funded", firm: "mffu", step: "Funded", status: "Active", balance: "$64,742", pnl: "+$14,742", pnlPositive: true, target: "—", pnlBarValue: 100, tradingDays: "35", drawdown: "—", consistency: "—" },
];

const menuItems = [
  { label: "View Details", danger: false },
  { label: "Mark as breached", danger: false },
  { label: "Edit Challenge", danger: false },
  { label: "Delete Challenge", danger: true },
];

function ContextMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-7 z-50 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[170px]">
      {menuItems.map((item, i) => (
        <button key={i} onClick={onClose} className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-muted ${item.danger ? "text-rose-500 hover:text-rose-600" : "text-foreground"}`}>{item.label}</button>
      ))}
    </div>
  );
}

function ThreeDotMenu({ onClick }: { onClick?: (e: React.MouseEvent) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={(e) => { e.stopPropagation(); onClick?.(e); setOpen((v) => !v); }} className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
      {open && <ContextMenu onClose={() => setOpen(false)} />}
    </div>
  );
}

function TableView({ accounts, onSelect }: { accounts: typeof evaluationAccounts; onSelect: () => void }) {
  return (
    <table className="w-full min-w-[620px] text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 whitespace-nowrap">Account</th>
          <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 whitespace-nowrap">Balance</th>
          <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 whitespace-nowrap">PnL / Target</th>
          <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 whitespace-nowrap">Trading Days</th>
          <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 whitespace-nowrap">Drawdown</th>
          <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 whitespace-nowrap">Consistency</th>
          <th className="pb-3" />
        </tr>
      </thead>
      <tbody>
        {accounts.map((acc) => (
          <tr key={acc.id} onClick={onSelect} className="border-b border-border last:border-0 cursor-pointer transition-all duration-150 hover:bg-primary/[0.03] hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] active:scale-[0.995]">
            <td className="py-4 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground">{acc.firm}</span>
                <span className="text-[10px] font-semibold text-muted-foreground border border-border rounded px-1.5 py-0.5 whitespace-nowrap">{acc.step}</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5 whitespace-nowrap">{acc.status}</span>
              </div>
            </td>
            <td className="py-4 pr-4 text-sm text-foreground font-medium whitespace-nowrap">{acc.balance}</td>
            <td className="py-4 pr-8 min-w-[140px]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`text-sm font-semibold ${acc.pnlPositive ? "text-primary" : "text-rose-500"}`}>{acc.pnl}</span>
                <span className="text-xs text-muted-foreground">{acc.target !== "—" ? `/ ${acc.target}` : "—"}</span>
              </div>
              {acc.pnlBarValue > 0 && (<div className="h-1 bg-muted rounded-full overflow-hidden w-24"><div className="h-full rounded-full bg-primary" style={{ width: `${acc.pnlBarValue}%` }} /></div>)}
            </td>
            <td className="py-4 pr-4 text-sm text-muted-foreground">{acc.tradingDays}</td>
            <td className="py-4 pr-4 text-sm text-muted-foreground whitespace-nowrap">{acc.drawdown}</td>
            <td className="py-4 pr-4 text-sm text-muted-foreground">{acc.consistency}</td>
            <td className="py-4 relative"><ThreeDotMenu /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProgressRow({ icon, label, sublabel, value, barValue, percentage, barColor = "bg-primary" }: { icon?: React.ReactNode; label: string; sublabel?: string; value: string; barValue: number; percentage: string; barColor?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="mt-0.5 shrink-0">{icon ?? <div className="w-5 h-5" />}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0"><span className="text-sm font-semibold text-foreground">{value}</span><div className="text-xs text-muted-foreground mt-0.5">{label}</div>{sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}</div>
          <span className="text-sm font-semibold text-foreground shrink-0">{percentage}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${barValue}%` }} /></div>
      </div>
    </div>
  );
}

function EvalAccountCard({ onSelect }: { onSelect: () => void }) {
  return (
    <div onClick={onSelect} className="bg-[hsl(220,20%,97%)] rounded-xl border border-border p-4 w-full sm:w-[320px] cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-primary/20 active:scale-[0.98] active:shadow-sm">
      <div className="flex items-center justify-between mb-2.5"><div className="flex items-center gap-2"><span className="text-xl font-black text-foreground tracking-tight leading-none">e8</span><span className="text-[10px] font-semibold text-muted-foreground border border-border bg-white rounded px-1.5 py-0.5 uppercase tracking-wide">STEP 1</span></div><ThreeDotMenu /></div>
      <div className="flex items-start justify-between mb-3"><div className="text-base font-bold text-foreground leading-tight">Balance: $10,486.03 <span className="text-sm font-semibold text-emerald-600">(+$486.03)</span></div><span className="text-xs text-muted-foreground whitespace-nowrap ml-2 mt-0.5">Use "e8 markets"</span></div>
      <div className="bg-primary/10 rounded-lg px-3 py-2.5 flex items-center gap-2.5 mb-3"><div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Clock className="w-3.5 h-3.5 text-primary" /></div><div><div className="text-sm font-semibold text-primary leading-tight">No time limit</div><div className="text-xs text-primary/70 mt-0.5">Started on Feb 03, 2025</div></div></div>
      <div className="text-xs text-muted-foreground mb-0.5"><span className="font-medium text-foreground">Account:</span> MetaTrader 5</div>
      <div className="mt-1">
        <ProgressRow icon={<div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-primary" /></div>} label="Target: 8%" value="Profit: $486.03" barValue={60.75} percentage="60.75%" barColor="bg-primary" />
        <ProgressRow icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} label="Maximum daily loss: 2%" value="$0" barValue={0} percentage="0%" barColor="bg-muted-foreground/30" />
        <ProgressRow icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} label="Maximum Drawdown: $800 (8%)" sublabel="Floor: $9,200" value="Drawdown: $0" barValue={0} percentage="0%" barColor="bg-muted-foreground/30" />
      </div>
    </div>
  );
}

function FundedAccountCard({ onSelect }: { onSelect: () => void }) {
  return (
    <div onClick={onSelect} className="bg-[hsl(220,20%,97%)] rounded-xl border border-border p-4 w-full sm:w-[320px] cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-primary/20 active:scale-[0.98] active:shadow-sm">
      <div className="flex items-center justify-between mb-2.5"><div className="flex items-center gap-2"><span className="text-xl font-black text-foreground tracking-tight leading-none">mffu</span><span className="text-[10px] font-semibold text-muted-foreground border border-border bg-white rounded px-1.5 py-0.5 uppercase tracking-wide">FUNDED</span></div><ThreeDotMenu /></div>
      <div className="flex items-start justify-between mb-3"><div className="text-base font-bold text-foreground leading-tight">Balance: $64,742 <span className="text-sm font-semibold text-emerald-600">(+$14,742)</span></div><span className="text-xs text-muted-foreground whitespace-nowrap ml-2 mt-0.5">Use "mffu"</span></div>
      <div className="bg-primary/10 rounded-lg px-3 py-2.5 flex items-center gap-2.5 mb-3"><div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Clock className="w-3.5 h-3.5 text-primary" /></div><div><div className="text-sm font-semibold text-primary leading-tight">No time limit</div><div className="text-xs text-primary/70 mt-0.5">Started on Apr 07, 2026</div></div></div>
      <div className="text-xs text-muted-foreground mb-0.5"><span className="font-medium text-foreground">Account:</span> Demo account</div>
      <div className="mt-1">
        <ProgressRow icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} label="Minimum trading days: 5" value="Days: 35" barValue={100} percentage="100%" barColor="bg-primary" />
        <ProgressRow icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} label="Maximum daily loss: 6%" value="$0" barValue={0} percentage="0%" barColor="bg-muted-foreground/30" />
      </div>
    </div>
  );
}

export default function PropFirmAccounts({ onSelectAccount }: { onSelectAccount: () => void }) {
  const [activeTab, setActiveTab] = useState<AccountTab>("Evaluations");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const currentAccounts = activeTab === "Evaluations" ? evaluationAccounts : fundedAccounts;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 pt-4 pb-0 gap-2">
        <div className="flex items-center">
          {accountTabs.map((tab) => (
            <button key={tab.label} onClick={() => setActiveTab(tab.label)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.label ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-1">
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}><LayoutList className="w-4 h-4" /></button>
          <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="border-b border-border" />
      <div className="p-5">
        {activeTab === "Breached" ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted-foreground/50" strokeWidth="1.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p className="text-sm font-medium text-muted-foreground">No breached accounts</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Keep your risk in check</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto"><TableView accounts={currentAccounts} onSelect={onSelectAccount} /></div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {activeTab === "Evaluations" && <EvalAccountCard onSelect={onSelectAccount} />}
            {activeTab === "Funded" && <FundedAccountCard onSelect={onSelectAccount} />}
          </div>
        )}
      </div>
    </div>
  );
}
