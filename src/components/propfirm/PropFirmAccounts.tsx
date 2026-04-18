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

type AccountActions = {
  onViewDetails: () => void;
  onMarkAsFailed: () => void;
  onEditChallenge: () => void;
  onDeleteChallenge: () => void;
  // Dynamic progression (Move to Step 2 / Move to Funding). Undefined = hide.
  progression?: { label: string; onClick: () => void };
  // Hide Mark as Failed when account is already breached/funded
  hideMarkAsFailed?: boolean;
};

function ThreeDotMenu({ actions, allowDelete = false }: { actions: AccountActions; allowDelete?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[190px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={actions.onViewDetails}>View Details</DropdownMenuItem>
        {actions.progression && (
          <DropdownMenuItem onSelect={actions.progression.onClick}>{actions.progression.label}</DropdownMenuItem>
        )}
        {!actions.hideMarkAsFailed && (
          <DropdownMenuItem onSelect={actions.onMarkAsFailed}>Mark as Failed</DropdownMenuItem>
        )}
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

type RealRow = ReturnType<typeof accountToRow>;

function TableView({
  rows,
  onSelect,
  makeActionsForRow,
  realIds,
}: {
  rows: RealRow[];
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


export default function PropFirmAccounts({ onSelectAccount }: { onSelectAccount: (id?: string) => void }) {
  const [activeTab, setActiveTab] = useState<AccountTab>("Evaluations");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [failedDialog, setFailedDialog] = useState<{ open: boolean; name: string; subtitle: string; accountId: string | null }>({ open: false, name: "", subtitle: "", accountId: null });
  const [editModal, setEditModal] = useState<{ open: boolean; challengeId?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; account: Account | null }>({ open: false, account: null });

  const { user } = useAuth();
  const { accounts, removeAccount, patchAccount, addAccount } = useAccountsContext();
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

  // Pick the single "top-level" account per challenge using lifecycle priority
  // Priority: breached > active funded > active step 2 > active step 1 > newest
  const pickLatestForChallenge = (group: Account[]): Account => {
    const sorted = [...group].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const breached = sorted.filter(a => a.status === 'breached');
    if (breached.length) return breached[0]; // most recent breached
    const fundedActive = sorted.find(
      a => a.step === 'funded' && (a.status === 'active' || a.status === 'funded')
    );
    if (fundedActive) return fundedActive;
    const step2Active = sorted.find(a => a.step === '2' && a.status === 'active');
    if (step2Active) return step2Active;
    const step1Active = sorted.find(a => a.step === '1' && a.status === 'active');
    if (step1Active) return step1Active;
    return sorted[0];
  };

  // Group all real propfirm accounts by challengeId, picking one "latest" per group.
  // Standalone accounts (no challengeId) pass through unchanged.
  const topLevelAccounts = useMemo(() => {
    const groups = new Map<string, Account[]>();
    const standalone: Account[] = [];
    for (const a of allRealPropfirmAccounts) {
      if (a.challengeId) {
        const arr = groups.get(a.challengeId) ?? [];
        arr.push(a);
        groups.set(a.challengeId, arr);
      } else {
        standalone.push(a);
      }
    }
    const picks: Account[] = [];
    groups.forEach(g => picks.push(pickLatestForChallenge(g)));
    return [...picks, ...standalone];
  }, [allRealPropfirmAccounts]);

  // Bucket per tab — strictly one row per challenge, hides 'completed'
  const realByTab = useMemo(() => {
    return {
      Evaluations: topLevelAccounts.filter(
        a => a.phase === 'evaluation' && a.status !== 'breached' && a.status !== 'completed'
      ),
      Funded: topLevelAccounts.filter(
        a => a.phase === 'funded' && a.status !== 'breached'
      ),
      Breached: topLevelAccounts.filter(a => a.status === 'breached'),
    };
  }, [topLevelAccounts]);

  const accountTabs: { label: AccountTab; count: number }[] = [
    { label: "Evaluations", count: realByTab.Evaluations.length },
    { label: "Funded", count: realByTab.Funded.length },
    { label: "Breached", count: realByTab.Breached.length },
  ];

  // Move current Step 1 account to Step 2: mark Step 1 completed+archived, create new Step 2.
  const moveToStep2 = (account: Account) => {
    if (!account.challengeId) {
      toast.error("No challenge linked to this account");
      return;
    }
    const challenge = getChallengeById(account.challengeId);
    if (!challenge) return;
    // Guard: do not duplicate Step 2
    const existingStep2 = accounts.find(
      a => a.challengeId === account.challengeId && a.step === '2'
    );
    if (existingStep2) {
      toast.error("Step 2 account already exists for this challenge");
      onSelectAccount(existingStep2.id);
      return;
    }
    // Mark current step as completed (preserve history) and archive
    patchAccount(account.id, { status: 'completed', isArchived: true });
    const newAcc = addAccount(
      `${challenge.nickname} (Step 2)`,
      challenge.balanceAmount ?? account.startingBalance,
      'propfirm',
      { challengeId: account.challengeId, step: '2', phase: 'evaluation', status: 'active' }
    );
    toast.success(`${challenge.nickname} moved to Step 2`);
    onSelectAccount(newAcc.id);
  };

  // Move to Funding: mark active accounts as completed, archive all, create new Funded account.
  const moveToFunding = (account: Account) => {
    if (!account.challengeId) {
      toast.error("No challenge linked to this account");
      return;
    }
    const challenge = getChallengeById(account.challengeId);
    if (!challenge) return;
    // Guard: do not duplicate Funded
    const existingFunded = accounts.find(
      a => a.challengeId === account.challengeId && a.step === 'funded'
    );
    if (existingFunded) {
      toast.error("Funded account already exists for this challenge");
      onSelectAccount(existingFunded.id);
      return;
    }
    // For each linked account: never overwrite breached/completed; promote 'active' → 'completed'
    accounts
      .filter(a => a.challengeId === account.challengeId)
      .forEach(a => {
        if (a.status === 'active') {
          patchAccount(a.id, { status: 'completed', isArchived: true });
        } else {
          patchAccount(a.id, { isArchived: true });
        }
      });
    const newAcc = addAccount(
      `${challenge.nickname} (Funded)`,
      challenge.balanceAmount ?? account.startingBalance,
      'propfirm',
      { challengeId: account.challengeId, step: 'funded', phase: 'funded', status: 'funded' }
    );
    updateChallenge(account.challengeId, { status: 'funded' });
    toast.success(`${challenge.nickname} moved to Funding`);
    onSelectAccount(newAcc.id);
  };

  // Real actions (fully wired). View Details opens the REAL details page for this account.
  const realActions = (account: Account): AccountActions => {
    const challenge = account.challengeId ? getChallengeById(account.challengeId) : undefined;
    const isBreached = account.status === 'breached' || challenge?.status === 'breached';
    const isFundedPhase = account.step === 'funded' || account.phase === 'funded';

    let progression: AccountActions['progression'];
    if (!isBreached && !isFundedPhase && challenge) {
      if (account.step === '1' && challenge.steps === 2) {
        progression = { label: "Move to Step 2", onClick: () => moveToStep2(account) };
      } else if (account.step === '1' && challenge.steps === 1) {
        progression = { label: "Move to Funding", onClick: () => moveToFunding(account) };
      } else if (account.step === '2') {
        progression = { label: "Move to Funding", onClick: () => moveToFunding(account) };
      }
    }

    return {
      onViewDetails: () => onSelectAccount(account.id),
      progression,
      hideMarkAsFailed: isBreached,
      onMarkAsFailed: () => {
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
    };
  };

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
    return realList.map(acc => {
      const ch = acc.challengeId ? getChallengeById(acc.challengeId) : undefined;
      return accountToRow(acc, ch, computeAccountStats(acc, ch, trades));
    });
  }, [activeTab, realByTab, getChallengeById, trades]);

  // Include archived breached accounts so Breached tab rows resolve to real accounts/actions
  const realIds = useMemo(() => new Set(allRealPropfirmAccounts.map(a => a.id)), [allRealPropfirmAccounts]);

  const handleRowSelect = (id: string) => {
    if (realIds.has(id)) onSelectAccount(id);
  };

  const makeActionsForRow = (id: string): AccountActions => {
    const realAcc = allRealPropfirmAccounts.find(a => a.id === id);
    if (realAcc) return realActions(realAcc);
    // Fallback (should never hit since rows are real-only)
    return {
      onViewDetails: () => {},
      onMarkAsFailed: () => {},
      onEditChallenge: () => {},
      onDeleteChallenge: () => {},
    };
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
          tableRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground">No {activeTab.toLowerCase()} accounts</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Track a new challenge to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto"><TableView rows={tableRows} onSelect={handleRowSelect} makeActionsForRow={makeActionsForRow} realIds={realIds} /></div>
          )
        ) : (
          <div className="flex flex-wrap gap-4">
            {activeTab === "Evaluations" && renderGridRealCards(realByTab.Evaluations)}
            {activeTab === "Funded" && renderGridRealCards(realByTab.Funded)}
            {activeTab === "Breached" && renderGridRealCards(realByTab.Breached)}
            {((activeTab === "Evaluations" && realByTab.Evaluations.length === 0) ||
              (activeTab === "Funded" && realByTab.Funded.length === 0)) && (
              <div className="flex flex-col items-center justify-center py-16 text-center w-full">
                <p className="text-sm font-medium text-muted-foreground">No {activeTab.toLowerCase()} accounts</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Track a new challenge to get started</p>
              </div>
            )}
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
