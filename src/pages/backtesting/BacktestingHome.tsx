import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, History, Pencil, Trash2, Eraser } from 'lucide-react';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { AddBacktestSessionModal } from '@/components/backtesting/AddBacktestSessionModal';
import { computeStats, loadRows, clearRows as clearRowsStore, clearSession as clearSessionStore } from '@/lib/backtestStore';
import { toast } from 'sonner';
import { format } from 'date-fns';

const BacktestingHome = () => {
  const navigate = useNavigate();
  const { accounts, addAccount, removeAccount, updateAccount, getBacktestingAccounts } = useAccountsContext();

  const [addOpen, setAddOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [clearTarget, setClearTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const sessions = useMemo(() => getBacktestingAccounts(), [getBacktestingAccounts, accounts]);

  const handleCreate = (name: string) => {
    const acc = addAccount(name, 0, 'backtesting');
    navigate(`/backtesting/${acc.id}`);
  };

  const handleRename = () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    const acc = accounts.find(a => a.id === renameTarget.id);
    if (!acc) return;
    updateAccount(acc.id, trimmed, acc.startingBalance, acc.accountMode, acc.currency);
    toast.success('Session renamed');
    setRenameTarget(null);
  };

  const handleClear = () => {
    if (!clearTarget) return;
    clearRowsStore(clearTarget.id);
    toast.success(`Cleared all trades from "${clearTarget.name}"`);
    setClearTarget(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    clearSessionStore(deleteTarget.id);
    removeAccount(deleteTarget.id);
    toast.success(`Deleted session "${deleteTarget.name}"`);
    setDeleteTarget(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <History className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No backtest sessions yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Create a session to start logging backtest trades with custom fields.
          </p>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Session
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((s) => {
            const rows = loadRows(s.id);
            const stats = computeStats(rows);
            return (
              <div
                key={s.id}
                onClick={() => navigate(`/backtesting/${s.id}`)}
                className="group rounded-2xl border border-border bg-card p-5 cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                      <History className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => { setRenameTarget({ id: s.id, name: s.name }); setRenameValue(s.name); }}>
                        <Pencil className="h-4 w-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setClearTarget({ id: s.id, name: s.name })}>
                        <Eraser className="h-4 w-4 mr-2" /> Clear Trades
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-rose-500 focus:text-rose-500"
                        onSelect={() => setDeleteTarget({ id: s.id, name: s.name })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Total Trades" value={String(stats.total)} />
                  <Stat label="Win Rate" value={stats.total ? `${stats.winRate.toFixed(1)}%` : '—'} />
                  <Stat label="Wins" value={String(stats.wins)} accent="text-emerald-500" />
                  <Stat label="Losses" value={String(stats.losses)} accent="text-rose-500" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddBacktestSessionModal open={addOpen} onOpenChange={setAddOpen} onCreate={handleCreate} />

      <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm font-medium">Session Name</Label>
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleRename} disabled={!renameValue.trim()} className="w-full">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!clearTarget} onOpenChange={(v) => !v && setClearTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all trades?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all trades in "{clearTarget?.name}". The session and its fields will remain. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-rose-500 hover:bg-rose-600">
              Clear Trades
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}" along with all its trades and field configurations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600">
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-lg bg-muted/30 p-3">
    <div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className={`text-base font-semibold ${accent ?? 'text-foreground'}`}>{value}</div>
  </div>
);

export default BacktestingHome;