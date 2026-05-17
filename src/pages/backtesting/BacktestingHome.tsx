import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, History, Pencil, Trash2, Eraser, ChevronRight } from 'lucide-react';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Fastest Manual Backtesting</h2>
      </div>
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
            // Cumulative R series for mini chart
            let running = 0;
            const series = rows
              .map(r => Number(r.values?.rr))
              .filter(n => Number.isFinite(n))
              .map((rr, i) => { running += rr; return { x: i, y: running }; });
            const chartData = series.length > 0 ? series : [{ x: 0, y: 0 }, { x: 1, y: 0 }];
            const isPositive = stats.totalR >= 0;
            const chartColor = isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))';
            const gradId = `bt-grad-${s.id}`;
            const totalRPositive = stats.totalR >= 0;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/backtesting/${s.id}`)}
                className="glass-card rounded-2xl p-5 flex flex-col cursor-pointer hover:border-primary/30 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-muted/40 border border-border flex items-center justify-center shrink-0">
                      <History className="w-4 h-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">{s.name.toUpperCase()}</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-medium text-primary border border-primary/20">
                          <span className="w-1 h-1 rounded-full bg-primary" /> BACKTEST
                        </span>
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">
                        SESSION · CREATED: {format(new Date(s.createdAt), 'M/d/yyyy')}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => navigate(`/backtesting/${s.id}`)}>
                        <ChevronRight className="w-4 h-4 mr-2" /> Open Session
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { setRenameTarget({ id: s.id, name: s.name }); setRenameValue(s.name); }}>
                        <Pencil className="w-4 h-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setClearTarget({ id: s.id, name: s.name })}>
                        <Eraser className="w-4 h-4 mr-2" /> Clear Trades
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-loss focus:text-loss"
                        onSelect={() => setDeleteTarget({ id: s.id, name: s.name })}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-3 gap-y-3 gap-x-4 mb-4">
                  <Metric label="WIN RATE" value={stats.total ? `${Math.round(stats.winRate)}%` : '—'} />
                  <Metric label="TRADES" value={String(stats.total)} />
                  <Metric
                    label="TOTAL R"
                    value={`${totalRPositive ? '+' : ''}${stats.totalR.toFixed(1)}R`}
                    className={totalRPositive ? 'text-profit' : 'text-loss'}
                  />
                  <Metric label="WINS" value={String(stats.wins)} className="text-profit" />
                  <Metric label="LOSSES" value={String(stats.losses)} className="text-loss" />
                  <Metric label="AVG R" value={`${stats.avgR.toFixed(1)}R`} />
                </div>

                {/* Mini chart */}
                <div className="h-16 -mx-1 mt-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="y"
                        stroke={chartColor}
                        strokeWidth={2}
                        fill={`url(#${gradId})`}
                        isAnimationActive={false}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
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

const Metric = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
    <p className={cn('text-sm font-medium text-foreground truncate', className)}>{value}</p>
  </div>
);

export default BacktestingHome;