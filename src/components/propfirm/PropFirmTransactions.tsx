import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Search, SlidersHorizontal, Pencil, MoreHorizontal, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, XCircle, EyeOff, Eye, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const transactions: Array<{ id: number; date: string; description: string; account: string; challenge: string; firm: string; type: "Income" | "Expense"; category: string; amount: number; status: TxStatus }> = [
  { id: 1, date: "Apr 13, 2026", description: "-", account: "-", challenge: "-", firm: "mffu", type: "Income", category: "Payout", amount: 500, status: "Reviewed" },
  { id: 2, date: "Apr 7, 2026", description: "-", account: "-", challenge: "-", firm: "mffu", type: "Expense", category: "Evaluation Fee", amount: -120, status: "Not reviewed" },
  { id: 3, date: "Feb 3, 2025", description: "-", account: "-", challenge: "-", firm: "e8", type: "Expense", category: "Evaluation Fee", amount: -47, status: "Reviewed" },
];

type FilterTab = "All transactions" | "Income" | "Expenses" | "Needs review";
const filterTabs: FilterTab[] = ["All transactions", "Income", "Expenses", "Needs review"];

type TxStatus = "Reviewed" | "Not reviewed" | "Ignored";

function StatusBadge({ status }: { status: TxStatus }) {
  const cls =
    status === "Reviewed"
      ? "bg-emerald-500/15 text-emerald-500"
      : status === "Ignored"
      ? "bg-muted text-muted-foreground"
      : "bg-amber-500/15 text-amber-500";
  return <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

function TxMetricCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <div className="text-xs text-muted-foreground font-medium mb-3">Total transactions</div>
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0"><Receipt className="w-4 h-4 text-muted-foreground" /></div><div><div className="text-2xl font-bold text-foreground tracking-tight">3</div><div className="text-xs text-muted-foreground mt-0.5">$667 volume</div></div></div>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <div className="text-xs text-muted-foreground font-medium mb-3">Total income</div>
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4 text-emerald-500" /></div><div><div className="text-2xl font-bold text-emerald-500 tracking-tight">+$500</div><div className="text-xs text-muted-foreground mt-0.5">Payouts &amp; commissions received</div></div></div>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <div className="text-xs text-muted-foreground font-medium mb-3">Total spent</div>
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0"><TrendingDown className="w-4 h-4 text-rose-500" /></div><div><div className="text-2xl font-bold text-rose-500 tracking-tight">-$167</div><div className="text-xs text-muted-foreground mt-0.5">$167 in eval fees</div></div></div>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <div className="text-xs text-muted-foreground font-medium mb-3">Net cash flow</div>
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><DollarSign className="w-4 h-4 text-primary" /></div><div><div className="text-2xl font-bold text-emerald-500 tracking-tight">+$333</div><div className="text-xs text-muted-foreground mt-0.5">Income minus expenses</div></div></div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: "Income" | "Expense" }) {
  return <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${type === "Income" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>{type}</span>;
}

function DateIcon() {
  return (
    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="11" rx="2" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3" fill="none"/><path d="M1 5.5h12" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3"/><path d="M4.5 1v2M9.5 1v2" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3" strokeLinecap="round"/></svg>
    </div>
  );
}

export default function PropFirmTransactions() {
  const [filterTab, setFilterTab] = useState<FilterTab>("All transactions");

  return (
    <div>
      <div className="mb-5"><h2 className="text-xl font-bold text-foreground">Transactions</h2><p className="text-sm text-muted-foreground mt-0.5">Review and categorize transactions synced from your connected accounts.</p></div>
      <TxMetricCards />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <div className="flex items-center gap-0 bg-card border border-border rounded-lg p-0.5 overflow-x-auto shrink-0">
          {filterTabs.map((tab) => (<button key={tab} onClick={() => setFilterTab(tab)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${filterTab === tab ? "bg-foreground text-background dark:bg-foreground dark:text-background" : "text-muted-foreground hover:text-foreground"}`}>{tab}</button>))}
        </div>
        <div className="flex items-center gap-2 flex-1 sm:justify-end">
          <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><input type="text" placeholder="Search by firm, challenge, account, or category" className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60" readOnly /></div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground transition-colors"><SlidersHorizontal className="w-3.5 h-3.5" />Filters</button>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-b border-border">
          <button className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground bg-muted/30 cursor-default">Bulk actions</button>
          <button className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground bg-card hover:bg-muted/30 transition-colors">+ Add transaction</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded border-border accent-primary" readOnly /></th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Description</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Account</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Challenge</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Firm</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Category</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Amount</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3 whitespace-nowrap">Status</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3.5"><input type="checkbox" className="rounded border-border accent-primary" readOnly /></td>
                  <td className="px-3 py-3.5 whitespace-nowrap"><div className="flex items-center gap-2"><DateIcon /><span className="text-xs text-foreground font-medium">{tx.date}</span></div></td>
                  <td className="px-3 py-3.5 text-xs text-muted-foreground">{tx.description}</td>
                  <td className="px-3 py-3.5 text-xs text-muted-foreground">{tx.account}</td>
                  <td className="px-3 py-3.5 text-xs text-muted-foreground">{tx.challenge}</td>
                  <td className="px-3 py-3.5"><div className="flex items-center gap-1.5"><span className="text-xs text-foreground font-medium">{tx.firm}</span><Pencil className="w-3 h-3 text-muted-foreground/50" /></div></td>
                  <td className="px-3 py-3.5"><TypeBadge type={tx.type} /></td>
                  <td className="px-3 py-3.5"><div className="flex items-center gap-1.5"><span className="text-xs text-foreground">{tx.category}</span><Pencil className="w-3 h-3 text-muted-foreground/50" /></div></td>
                  <td className="px-3 py-3.5 text-right whitespace-nowrap"><span className={`text-sm font-semibold ${tx.amount > 0 ? "text-emerald-500" : "text-rose-500"}`}>{tx.amount > 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}</span></td>
                  <td className="px-3 py-3.5"><span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Reviewed</span></td>
                  <td className="px-3 py-3.5"><button className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Transactions per page:</span><button className="flex items-center gap-1 border border-border rounded-md px-2 py-1 text-foreground text-xs bg-card">10<ChevronDown className="w-3 h-3" /></button></div>
          <span className="text-xs text-muted-foreground">1 – 3 of 3 transactions</span>
          <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground flex items-center gap-1"><input type="number" defaultValue={1} className="w-8 text-center border border-border rounded-md py-0.5 text-xs focus:outline-none" readOnly /><span>of 1 pages</span></span><div className="flex items-center gap-1"><button className="p-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40" disabled><ChevronLeft className="w-3.5 h-3.5" /></button><button className="p-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40" disabled><ChevronRight className="w-3.5 h-3.5" /></button></div></div>
        </div>
      </div>
    </div>
  );
}
