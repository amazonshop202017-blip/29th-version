import { useState, useMemo } from "react";
import { MoreHorizontal, Clock, CheckCircle2, LayoutList, LayoutGrid } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MarkAsFailedDialog } from "./MarkAsFailedDialog";
import { TrackAccountModal } from "./TrackAccountModal";
import { RealAccountCard } from "./RealAccountCard";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountsContext, type Account } from "@/contexts/AccountsContext";
import { useChallengesContext } from "@/contexts/ChallengesContext";
import { useTradesContext } from "@/contexts/TradesContext";
import { computeAccountStats, accountToRow } from "@/lib/propFirmStats";

type AccountTab = "Evaluations" | "Funded" | "Breached";
type ViewMode = "list" | "grid";

const demoEvaluationAccounts = [
  { id: "e8-eval", firm: "e8", step: "Step 1", status: "Active", balance: "$10,486.03", pnl: "+$486.03", pnlPositive: true, target: "8%", pnlBarValue: 60, tradingDays: "—", drawdown: "$0 / Max $800", consistency: "—" },
];

const demoFundedAccounts = [
  { id: "mffu-funded", firm: "mffu", step: "Funded", status: "Active", balance: "$64,742", pnl: "+$14,742", pnlPositive: true, target: "—", pnlBarValue: 100, tradingDays: "35", drawdown: "—", consistency: "—" },
];

type AccountActions = {
  onViewDetails: () => void;
  onMoveToFunding: () => void;
  onMarkAsFailed: () => void;
  onEditChallenge: () => void;
  onDeleteChallenge: () => void;
};

function ThreeDotMenu({ actions, allowDelete = false }: { actions: AccountActions; allowDelete?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[190px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={actions.onViewDetails}>View Details</DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onMoveToFunding}>Move to Funding</DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onMarkAsFailed}>Mark as Failed</DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onEditChallenge}>Edit Challenge</DropdownMenuItem>
        <DropdownMenuSeparator />
        {allowDelete ? (
          <DropdownMenuItem onSelect={actions.onDeleteChallenge} className="text-rose-500 focus:text-rose-500">
            Delete Challenge
          </DropdownMenuItem>
        ) : (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenuItem
                    disabled
                    className="text-rose-500/60 focus:text-rose-500/60 cursor-not-allowed opacity-60"
                    onSelect={(e) => e.preventDefault()}
                  >
                    Delete Challenge
                  </DropdownMenuItem>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">Disabled</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type RowShape = typeof demoEvaluationAccounts[number];
type RealRow = ReturnType<typeof accountToRow>;

function TableView({
  rows,
  onSelect,
  makeActionsForRow,
  realIds,
}: {
  rows: (RowShape | RealRow)[];
  onSelect: (id: string) => void;
  makeActionsForRow: (id: string) => AccountActions;
  realIds: Set<string>;
}) {
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
        {rows.map((acc) => {
          const isReal = realIds.has(acc.id);
          return (
            <tr key={acc.id} onClick={() => onSelect(acc.id)} className="border-b border-border last:border-0 cursor-pointer transition-all duration-150 hover:bg-primary/[0.03] hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] active:scale-[0.995]">
              <td className="py-4 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground">{acc.firm}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground border border-border rounded px-1.5 py-0.5 whitespace-nowrap">{acc.step}</span>
                  <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap ${
                    acc.status === "Breached" ? "text-rose-500 bg-rose-500/15" : "text-emerald-500 bg-emerald-500/15"
                  }`}>{acc.status}</span>
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
              <td className="py-4 relative"><ThreeDotMenu actions={makeActionsForRow(acc.id)} allowDelete={isReal} /></td>
            </tr>
          );
        })}
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

function EvalAccountCard({ onSelect, actions }: { onSelect: () => void; actions: AccountActions }) {
  return (
    <div onClick={onSelect} className="bg-muted/40 rounded-xl border border-border p-4 w-full sm:w-[320px] cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-primary/20 active:scale-[0.98] active:shadow-sm">
      <div className="flex items-center justify-between mb-2.5"><div className="flex items-center gap-2"><span className="text-xl font-black text-foreground tracking-tight leading-none">e8</span><span className="text-[10px] font-semibold text-muted-foreground border border-border bg-card rounded px-1.5 py-0.5 uppercase tracking-wide">STEP 1</span></div><ThreeDotMenu actions={actions} /></div>
      <div className="flex items-start justify-between mb-3"><div className="text-base font-bold text-foreground leading-tight">Balance: $10,486.03 <span className="text-sm font-semibold text-emerald-500">(+$486.03)</span></div><span className="text-xs text-muted-foreground whitespace-nowrap ml-2 mt-0.5">Use "e8 markets"</span></div>
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

function FundedAccountCard({ onSelect, actions }: { onSelect: () => void; actions: AccountActions }) {
  return (
    <div onClick={onSelect} className="bg-muted/40 rounded-xl border border-border p-4 w-full sm:w-[320px] cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-primary/20 active:scale-[0.98] active:shadow-sm">
      <div className="flex items-center justify-between mb-2.5"><div className="flex items-center gap-2"><span className="text-xl font-black text-foreground tracking-tight leading-none">mffu</span><span className="text-[10px] font-semibold text-muted-foreground border border-border bg-card rounded px-1.5 py-0.5 uppercase tracking-wide">FUNDED</span></div><ThreeDotMenu actions={actions} /></div>
      <div className="flex items-start justify-between mb-3"><div className="text-base font-bold text-foreground leading-tight">Balance: $64,742 <span className="text-sm font-semibold text-emerald-500">(+$14,742)</span></div><span className="text-xs text-muted-foreground whitespace-nowrap ml-2 mt-0.5">Use "mffu"</span></div>
      <div className="bg-primary/10 rounded-lg px-3 py-2.5 flex items-center gap-2.5 mb-3"><div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Clock className="w-3.5 h-3.5 text-primary" /></div><div><div className="text-sm font-semibold text-primary leading-tight">No time limit</div><div className="text-xs text-primary/70 mt-0.5">Started on Apr 07, 2026</div></div></div>
      <div className="text-xs text-muted-foreground mb-0.5"><span className="font-medium text-foreground">Account:</span> Demo account</div>
      <div className="mt-1">
        <ProgressRow icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} label="Minimum trading days: 5" value="Days: 35" barValue={100} percentage="100%" barColor="bg-primary" />
        <ProgressRow icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} label="Maximum daily loss: 6%" value="$0" barValue={0} percentage="0%" barColor="bg-muted-foreground/30" />
      </div>
    </div>
  );
}

export default function PropFirmAccounts({ onSelectAccount }: { onSelectAccount: (id?: string) => void }) {
  const [activeTab, setActiveTab] = useState<AccountTab>("Evaluations");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [failedDialog, setFailedDialog] = useState<{ open: boolean; name: string; subtitle: string; accountId: string | null }>({ open: false, name: "", subtitle: "", accountId: null });
  const [editModal, setEditModal] = useState<{ open: boolean; challengeId?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; account: Account | null }>({ open: false, account: null });

  const { user } = useAuth();
  const { accounts, removeAccount, patchAccount, archiveAccount } = useAccountsContext();
  const { challenges, getChallengeById, updateChallenge, removeChallenge } = useChallengesContext();
  const { trades } = useTradesContext();

  // All real propfirm accounts for current user (used for Breached tab — includes archived)
  const allRealPropfirmAccounts = useMemo(
    () => accounts.filter(a => a.accountMode === 'propfirm' && a.userId === (user?.userId || '')),
    [accounts, user?.userId]
  );

  // Active (non-archived) accounts — used for Evaluations / Funded buckets and row actions
  const realPropfirmAccounts = useMemo(
    () => allRealPropfirmAccounts.filter(a => !a.isArchived),
    [allRealPropfirmAccounts]
  );

  // Bucket per tab
  const realByTab = useMemo(() => {
    const buckets = {
      // Evaluations: anything in evaluation phase that is NOT breached and not archived
      Evaluations: realPropfirmAccounts.filter(a => a.phase === 'evaluation' && a.status !== 'breached'),
      // Funded: anything in funded phase that is NOT breached and not archived
      Funded: realPropfirmAccounts.filter(a => a.phase === 'funded' && a.status !== 'breached'),
      // Breached tab includes archived breached accounts too
      Breached: allRealPropfirmAccounts.filter(a => a.status === 'breached'),
    };
    if (typeof window !== 'undefined') {
      console.log('[PropFirmAccounts] buckets', {
        all: allRealPropfirmAccounts.map(a => ({ id: a.id, name: a.name, status: a.status, phase: a.phase, isArchived: a.isArchived, userId: a.userId })),
        breachedCount: buckets.Breached.length,
      });
    }
    return buckets;
  }, [realPropfirmAccounts, allRealPropfirmAccounts]);

  const accountTabs: { label: AccountTab; count: number }[] = [
    { label: "Evaluations", count: demoEvaluationAccounts.length + realByTab.Evaluations.length },
    { label: "Funded", count: demoFundedAccounts.length + realByTab.Funded.length },
    { label: "Breached", count: 0 + realByTab.Breached.length },
  ];

  // Demo actions (toast/dialog only — no persistence). Demo opens demo details (no id).
  const demoActions = (acc: typeof demoEvaluationAccounts[number]): AccountActions => ({
    onViewDetails: () => onSelectAccount(),
    onMoveToFunding: () => toast.info("Coming soon"),
    onMarkAsFailed: () =>
      setFailedDialog({
        open: true,
        name: acc.firm,
        subtitle: acc.firm === "e8" ? 'Use "e8 markets"' : `Use "${acc.firm}"`,
        accountId: null,
      }),
    onEditChallenge: () => setEditModal({ open: true }),
    onDeleteChallenge: () => {},
  });

  // Real actions (fully wired). View Details opens the REAL details page for this account.
  const realActions = (account: Account): AccountActions => ({
    onViewDetails: () => onSelectAccount(account.id),
    onMoveToFunding: () => {
      patchAccount(account.id, { phase: 'funded', step: 'funded', status: 'active' });
      if (account.challengeId) updateChallenge(account.challengeId, { status: 'funded' });
      toast.success(`${account.name} moved to Funding`);
    },
    onMarkAsFailed: () => {
      const challenge = account.challengeId ? getChallengeById(account.challengeId) : undefined;
      setFailedDialog({
        open: true,
        name: challenge?.firm || account.name,
        subtitle: `Use "${challenge?.firm || account.name}"`,
        accountId: account.id,
      });
    },
    onEditChallenge: () => {
      if (account.challengeId) setEditModal({ open: true, challengeId: account.challengeId });
      else toast.error("No challenge linked to this account");
    },
    onDeleteChallenge: () => setDeleteDialog({ open: true, account }),
  });

  const handleConfirmFailed = (reason: string) => {
    if (!failedDialog.accountId) return;
    const acc = accounts.find(a => a.id === failedDialog.accountId);
    if (!acc) return;
    const breachedAt = new Date().toISOString();
    if (acc.challengeId) {
      // Patch ALL accounts linked to this challenge in one go: mark target breached, archive all
      accounts
        .filter(a => a.challengeId === acc.challengeId)
        .forEach(a => {
          if (a.id === acc.id) {
            patchAccount(a.id, { status: 'breached', breachReason: reason, breachedAt, isArchived: true });
          } else {
            patchAccount(a.id, { isArchived: true });
          }
        });
      updateChallenge(acc.challengeId, { status: 'breached' });
    } else {
      patchAccount(acc.id, { status: 'breached', breachReason: reason, breachedAt, isArchived: true });
    }
  };

  const handleConfirmDelete = () => {
    const acc = deleteDialog.account;
    if (!acc) return;
    if (acc.challengeId) removeChallenge(acc.challengeId);
    removeAccount(acc.id);
    toast.success(`Challenge deleted`);
    setDeleteDialog({ open: false, account: null });
  };

  // Build rows for table view (real first, then demo)
  const tableRows = useMemo(() => {
    if (activeTab === "Breached") {
      return realByTab.Breached.map(acc => {
        const ch = acc.challengeId ? getChallengeById(acc.challengeId) : undefined;
        return accountToRow(acc, ch, computeAccountStats(acc, ch, trades));
      });
    }
    const realList = activeTab === "Evaluations" ? realByTab.Evaluations : realByTab.Funded;
    const realRows = realList.map(acc => {
      const ch = acc.challengeId ? getChallengeById(acc.challengeId) : undefined;
      return accountToRow(acc, ch, computeAccountStats(acc, ch, trades));
    });
    const demoList = activeTab === "Evaluations" ? demoEvaluationAccounts : demoFundedAccounts;
    return [...realRows, ...demoList];
  }, [activeTab, realByTab, getChallengeById, trades]);

  // Include archived breached accounts so Breached tab rows resolve to real accounts/actions
  const realIds = useMemo(() => new Set(allRealPropfirmAccounts.map(a => a.id)), [allRealPropfirmAccounts]);

  const handleRowSelect = (id: string) => {
    if (realIds.has(id)) onSelectAccount(id);
    else onSelectAccount();
  };

  const makeActionsForRow = (id: string): AccountActions => {
    const realAcc = allRealPropfirmAccounts.find(a => a.id === id);
    if (realAcc) return realActions(realAcc);
    // demo row
    const demoAcc =
      demoEvaluationAccounts.find(d => d.id === id) ?? demoFundedAccounts.find(d => d.id === id);
    return demoAcc ? demoActions(demoAcc) : demoActions(demoEvaluationAccounts[0]);
  };

  const renderGridRealCards = (list: Account[]) =>
    list.map(acc => {
      const ch = acc.challengeId ? getChallengeById(acc.challengeId) : undefined;
      if (!ch) return null;
      return (
        <RealAccountCard
          key={acc.id}
          account={acc}
          challenge={ch}
          trades={trades}
          onSelect={() => onSelectAccount(acc.id)}
          ThreeDotMenu={ThreeDotMenu}
          actions={realActions(acc)}
        />
      );
    });

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm">
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
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-foreground text-background dark:bg-foreground dark:text-background" : "text-muted-foreground hover:text-foreground"}`}><LayoutList className="w-4 h-4" /></button>
          <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-foreground text-background dark:bg-foreground dark:text-background" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="border-b border-border" />
      <div className="p-5">
        {activeTab === "Breached" && tableRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted-foreground/50" strokeWidth="1.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p className="text-sm font-medium text-muted-foreground">No breached accounts</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Keep your risk in check</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto"><TableView rows={tableRows} onSelect={handleRowSelect} makeActionsForRow={makeActionsForRow} realIds={realIds} /></div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {activeTab === "Evaluations" && (
              <>
                {renderGridRealCards(realByTab.Evaluations)}
                <EvalAccountCard onSelect={() => onSelectAccount()} actions={demoActions(demoEvaluationAccounts[0])} />
              </>
            )}
            {activeTab === "Funded" && (
              <>
                {renderGridRealCards(realByTab.Funded)}
                <FundedAccountCard onSelect={() => onSelectAccount()} actions={demoActions(demoFundedAccounts[0])} />
              </>
            )}
            {activeTab === "Breached" && renderGridRealCards(realByTab.Breached)}
          </div>
        )}
      </div>

      <MarkAsFailedDialog
        open={failedDialog.open}
        onOpenChange={(o) => setFailedDialog((s) => ({ ...s, open: o }))}
        accountName={failedDialog.name}
        accountSubtitle={failedDialog.subtitle}
        onConfirm={failedDialog.accountId ? handleConfirmFailed : undefined}
      />

      <TrackAccountModal
        open={editModal.open}
        onClose={() => setEditModal({ open: false })}
        mode="edit"
        challengeId={editModal.challengeId}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => !o && setDeleteDialog({ open: false, account: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this challenge?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the challenge and its linked account ({deleteDialog.account?.name}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-rose-500 hover:bg-rose-500/90 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
