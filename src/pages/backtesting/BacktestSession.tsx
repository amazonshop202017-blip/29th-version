import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, X, Eraser } from 'lucide-react';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useBacktestSession } from '@/hooks/useBacktestSession';
import { computeStats } from '@/lib/backtestStore';
import type { BacktestRow } from '@/lib/backtestStore';
import { Button } from '@/components/ui/button';
import { AddFieldModal } from '@/components/backtesting/AddFieldModal';
import { AddTradeModal } from '@/components/backtesting/AddTradeModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const BacktestSession = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { accounts, removeAccount } = useAccountsContext();
  const account = accounts.find(a => a.id === accountId && a.accountMode === 'backtesting');

  const { fields, rows, addField, removeField, addRow, updateRow, deleteRow, clearRows, clearAll } =
    useBacktestSession(accountId);

  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BacktestRow | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const stats = useMemo(() => computeStats(rows), [rows]);

  if (!account) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => navigate('/backtesting')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="mt-8 text-center text-muted-foreground">Session not found.</div>
      </div>
    );
  }

  const formatVal = (v: any) => {
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={() => navigate('/backtesting')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h2 className="text-xl font-semibold truncate">{account.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setClearOpen(true)} className="gap-2">
            <Eraser className="h-4 w-4" /> Clear Trades
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="gap-2 text-rose-500 hover:text-rose-600">
            <Trash2 className="h-4 w-4" /> Delete Session
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Total Trades" value={String(stats.total)} />
        <Stat label="Wins" value={String(stats.wins)} accent="text-emerald-500" />
        <Stat label="Losses" value={String(stats.losses)} accent="text-rose-500" />
        <Stat label="Win Rate" value={stats.total ? `${stats.winRate.toFixed(1)}%` : '—'} />
        <Stat label="Avg R" value={stats.avgR ? stats.avgR.toFixed(2) : '—'} />
        <Stat label="Total R" value={stats.totalR ? stats.totalR.toFixed(2) : '—'} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" onClick={() => setFieldModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Field
        </Button>
        <Button onClick={() => { setEditingRow(null); setTradeModalOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Add Trade
        </Button>
      </div>

      {/* Trades table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {fields.map((f) => (
                <th key={f.id} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {f.label}
                    {!f.builtin && (
                      <button
                        onClick={() => removeField(f.id)}
                        className="rounded p-0.5 hover:bg-muted text-muted-foreground"
                        title="Remove field"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={fields.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No trades yet. Click "Add Trade" to log your first one.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  {fields.map((f) => (
                    <td key={f.id} className="px-4 py-3 whitespace-nowrap">{formatVal(r.values[f.id])}</td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => { setEditingRow(r); setTradeModalOpen(true); }}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground mr-1"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRow(r.id)}
                      className="p-1.5 rounded-md hover:bg-muted text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddFieldModal
        open={fieldModalOpen}
        onOpenChange={setFieldModalOpen}
        onAdd={addField}
        existingIds={fields.map(f => f.id)}
      />

      <AddTradeModal
        open={tradeModalOpen}
        onOpenChange={(v) => { setTradeModalOpen(v); if (!v) setEditingRow(null); }}
        fields={fields}
        initialValues={editingRow?.values}
        isEditing={!!editingRow}
        onSave={(values) => {
          if (editingRow) updateRow(editingRow.id, values);
          else addRow(values);
        }}
      />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all trades?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all trades in this session. Fields will remain. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { clearRows(); toast.success('Cleared all trades'); }}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Clear Trades
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{account.name}" along with all its trades and field configurations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAll();
                removeAccount(account.id);
                toast.success('Session deleted');
                navigate('/backtesting');
              }}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className={`text-base font-semibold ${accent ?? 'text-foreground'}`}>{value}</div>
  </div>
);

export default BacktestSession;