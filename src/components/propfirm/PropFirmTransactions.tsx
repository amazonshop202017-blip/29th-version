import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Search, SlidersHorizontal, Pencil, MoreHorizontal, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, XCircle, EyeOff, Eye, Trash2, Inbox } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CATEGORY_LABELS,
  PropFirmTransaction,
  TxStatus,
  useTransactionsContext,
} from "@/contexts/TransactionsContext";
import { useChallengesContext } from "@/contexts/ChallengesContext";
import { useAccountsContext } from "@/contexts/AccountsContext";
import { AddEditTransactionModal } from "./AddEditTransactionModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type FilterTab = "all" | "income" | "expense" | "needs_review";
const filterTabs: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All transactions" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expenses" },
  { id: "needs_review", label: "Needs review" },
];

function StatusBadge({ status }: { status: TxStatus }) {
  const cls =
    status === "reviewed"
      ? "bg-emerald-500/15 text-emerald-500"
      : status === "ignored"
      ? "bg-muted text-muted-foreground"
      : "bg-amber-500/15 text-amber-500";
  const label = status === "reviewed" ? "Reviewed" : status === "ignored" ? "Ignored" : "Not reviewed";
  return <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function TypeBadge({ type }: { type: "income" | "expense" }) {
  return <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${type === "income" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>{type}</span>;
}

function DateIcon() {
  return (
    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="11" rx="2" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3" fill="none"/><path d="M1 5.5h12" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3"/><path d="M4.5 1v2M9.5 1v2" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3" strokeLinecap="round"/></svg>
    </div>
  );
}

function fmtMoney(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PropFirmTransactions() {
  const { transactions, updateTransaction, deleteTransaction, bulkUpdateStatus, bulkDelete } = useTransactionsContext();
  const { challenges } = useChallengesContext();
  const { accounts } = useAccountsContext();

  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PropFirmTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const challengeName = (id?: string) => id ? challenges.find(c => c.challengeId === id)?.nickname || "—" : "—";
  const accountName = (id?: string) => id ? accounts.find(a => a.id === id)?.name || "—" : "—";

  // Tab + search filtering. "All" includes ignored; other tabs exclude ignored.
  const filtered = useMemo(() => {
    let list = [...transactions].sort((a, b) => +new Date(b.date) - +new Date(a.date));

    if (filterTab === "income") list = list.filter(t => t.type === "income" && t.status !== "ignored");
    else if (filterTab === "expense") list = list.filter(t => t.type === "expense" && t.status !== "ignored");
    else if (filterTab === "needs_review") list = list.filter(t => t.status === "not_reviewed");
    // "all" includes everything (including ignored)

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t => {
        const cn = challengeName(t.challengeId).toLowerCase();
        const an = accountName(t.accountId).toLowerCase();
        const cat = CATEGORY_LABELS[t.category].toLowerCase();
        return (
          cn.includes(q) ||
          an.includes(q) ||
          t.firm.toLowerCase().includes(q) ||
          cat.includes(q) ||
          (t.description || "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [transactions, filterTab, search, challenges, accounts]);

  // Summary cards: always exclude ignored
  const summary = useMemo(() => {
    const nonIgnored = filtered.filter(t => t.status !== "ignored");
    const income = nonIgnored.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = nonIgnored.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const volume = nonIgnored.reduce((s, t) => s + t.amount, 0);
    return { count: nonIgnored.length, volume, income, expense, net: income - expense };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const allSelected = pageItems.length > 0 && pageItems.every(t => selectedIds.has(t.id));
  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) pageItems.forEach(t => next.delete(t.id));
      else pageItems.forEach(t => next.add(t.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleStatusChange = (id: string, status: TxStatus) => {
    updateTransaction(id, { status });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTransaction(deleteId);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteId); return n; });
    toast.success("Transaction deleted");
    setDeleteId(null);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    bulkDelete(ids);
    setSelectedIds(new Set());
    toast.success(`${ids.length} transaction${ids.length === 1 ? '' : 's'} deleted`);
    setBulkDeleteOpen(false);
  };

  const handleBulkStatus = (status: TxStatus) => {
    const ids = Array.from(selectedIds);
    bulkUpdateStatus(ids, status);
    setSelectedIds(new Set());
    toast.success(`${ids.length} transaction${ids.length === 1 ? '' : 's'} updated`);
  };

  const isEmpty = transactions.length === 0;
  const isFilteredEmpty = !isEmpty && filtered.length === 0;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-foreground">Transactions</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Review and categorize transactions synced from your connected accounts.</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="text-xs text-muted-foreground font-medium mb-3">Total transactions</div>
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0"><Receipt className="w-4 h-4 text-muted-foreground" /></div><div><div className="text-2xl font-bold text-foreground tracking-tight">{summary.count}</div><div className="text-xs text-muted-foreground mt-0.5">${fmtMoney(summary.volume)} volume</div></div></div>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="text-xs text-muted-foreground font-medium mb-3">Total income</div>
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4 text-emerald-500" /></div><div><div className="text-2xl font-bold text-emerald-500 tracking-tight">+${fmtMoney(summary.income)}</div><div className="text-xs text-muted-foreground mt-0.5">Payouts &amp; commissions received</div></div></div>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="text-xs text-muted-foreground font-medium mb-3">Total spent</div>
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0"><TrendingDown className="w-4 h-4 text-rose-500" /></div><div><div className="text-2xl font-bold text-rose-500 tracking-tight">-${fmtMoney(summary.expense)}</div><div className="text-xs text-muted-foreground mt-0.5">Fees &amp; expenses</div></div></div>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="text-xs text-muted-foreground font-medium mb-3">Net cash flow</div>
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><DollarSign className="w-4 h-4 text-primary" /></div><div><div className={cn("text-2xl font-bold tracking-tight", summary.net >= 0 ? "text-emerald-500" : "text-rose-500")}>{summary.net >= 0 ? "+" : "-"}${fmtMoney(Math.abs(summary.net))}</div><div className="text-xs text-muted-foreground mt-0.5">Income minus expenses</div></div></div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <div className="flex items-center gap-0 bg-card border border-border rounded-lg p-0.5 overflow-x-auto shrink-0">
          {filterTabs.map((tab) => (
            <button key={tab.id} onClick={() => { setFilterTab(tab.id); setPage(0); }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${filterTab === tab.id ? "bg-foreground text-background dark:bg-foreground dark:text-background" : "text-muted-foreground hover:text-foreground"}`}>{tab.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 sm:justify-end">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search by firm, challenge, account, or category" className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60" />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground transition-colors"><SlidersHorizontal className="w-3.5 h-3.5" />Filters</button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground bg-card hover:bg-muted/30 transition-colors flex items-center gap-1">
                    Bulk actions ({selectedIds.size})
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => handleBulkStatus("reviewed")}><CheckCircle2 className="w-4 h-4 mr-2" />Mark reviewed</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatus("not_reviewed")}><XCircle className="w-4 h-4 mr-2" />Mark not reviewed</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatus("ignored")}><EyeOff className="w-4 h-4 mr-2" />Mark ignored</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setBulkDeleteOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {selectedIds.size === 0 && (
              <span className="text-xs text-muted-foreground">{filtered.length} transaction{filtered.length === 1 ? "" : "s"}</span>
            )}
          </div>
          <button onClick={() => { setEditing(null); setAddOpen(true); }} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground bg-card hover:bg-muted/30 transition-colors">+ Add transaction</button>
        </div>

        {/* Empty */}
        {isEmpty ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3"><Inbox className="w-6 h-6 text-muted-foreground" /></div>
            <div className="text-sm font-semibold text-foreground">No transactions yet</div>
            <div className="text-xs text-muted-foreground mt-1 mb-4">Track payouts, fees, and other prop-firm cash flow.</div>
            <button onClick={() => { setEditing(null); setAddOpen(true); }} className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">+ Add transaction</button>
          </div>
        ) : isFilteredEmpty ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-6">
            <div className="text-sm font-semibold text-foreground">No matching transactions</div>
            <div className="text-xs text-muted-foreground mt-1">Try clearing your filters or search.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded border-border accent-primary" checked={allSelected} onChange={toggleAll} /></th>
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
                {pageItems.map((tx) => (
                  <tr key={tx.id} className={cn("border-b border-border last:border-0 hover:bg-muted/10 transition-colors", tx.status === "ignored" && "opacity-60")}>
                    <td className="px-4 py-3.5"><input type="checkbox" className="rounded border-border accent-primary" checked={selectedIds.has(tx.id)} onChange={() => toggleOne(tx.id)} /></td>
                    <td className="px-3 py-3.5 whitespace-nowrap"><div className="flex items-center gap-2"><DateIcon /><span className="text-xs text-foreground font-medium">{format(new Date(tx.date), "MMM d, yyyy")}</span></div></td>
                    <td className="px-3 py-3.5 text-xs text-muted-foreground max-w-[200px] truncate">{tx.description || "—"}</td>
                    <td className="px-3 py-3.5 text-xs text-muted-foreground">{accountName(tx.accountId)}</td>
                    <td className="px-3 py-3.5 text-xs text-muted-foreground">{challengeName(tx.challengeId)}</td>
                    <td className="px-3 py-3.5"><div className="flex items-center gap-1.5"><span className="text-xs text-foreground font-medium">{tx.firm}</span><button onClick={() => { setEditing(tx); setAddOpen(true); }} className="text-muted-foreground/50 hover:text-foreground"><Pencil className="w-3 h-3" /></button></div></td>
                    <td className="px-3 py-3.5"><TypeBadge type={tx.type} /></td>
                    <td className="px-3 py-3.5"><div className="flex items-center gap-1.5"><span className="text-xs text-foreground">{CATEGORY_LABELS[tx.category]}</span><button onClick={() => { setEditing(tx); setAddOpen(true); }} className="text-muted-foreground/50 hover:text-foreground"><Pencil className="w-3 h-3" /></button></div></td>
                    <td className="px-3 py-3.5 text-right whitespace-nowrap"><span className={`text-sm font-semibold ${tx.type === "income" ? "text-emerald-500" : "text-rose-500"}`}>{tx.type === "income" ? "+" : "-"}${fmtMoney(tx.amount)}</span></td>
                    <td className="px-3 py-3.5"><StatusBadge status={tx.status} /></td>
                    <td className="px-3 py-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => { setEditing(tx); setAddOpen(true); }}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                          {tx.status === "reviewed" ? (
                            <DropdownMenuItem onClick={() => handleStatusChange(tx.id, "not_reviewed")}><XCircle className="w-4 h-4 mr-2" />Mark as not reviewed</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleStatusChange(tx.id, "reviewed")}><CheckCircle2 className="w-4 h-4 mr-2" />Mark as reviewed</DropdownMenuItem>
                          )}
                          {tx.status === "ignored" ? (
                            <DropdownMenuItem onClick={() => handleStatusChange(tx.id, "reviewed")}><Eye className="w-4 h-4 mr-2" />Mark as unignored</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleStatusChange(tx.id, "ignored")}><EyeOff className="w-4 h-4 mr-2" />Mark as ignored</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteId(tx.id)} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isEmpty && !isFilteredEmpty && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Per page:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 border border-border rounded-md px-2 py-1 text-foreground text-xs bg-card">{pageSize}<ChevronDown className="w-3 h-3" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {[10, 25, 50].map(n => <DropdownMenuItem key={n} onClick={() => { setPageSize(n); setPage(0); }}>{n}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <span className="text-xs text-muted-foreground">{filtered.length === 0 ? 0 : safePage * pageSize + 1} – {Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Page {safePage + 1} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} className="p-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1} className="p-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddEditTransactionModal open={addOpen} onClose={() => { setAddOpen(false); setEditing(null); }} editing={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} transaction{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
