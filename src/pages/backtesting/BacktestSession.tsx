import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, Eraser, Save } from 'lucide-react';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useBacktestSession } from '@/hooks/useBacktestSession';
import { computeStats, fieldLabelFromCatalog, sortFieldIds } from '@/lib/backtestStore';
import type { BacktestRow, FieldDef } from '@/lib/backtestStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
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
  const [editingRow, setEditingRow] = useState<BacktestRow | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Inline form state — keyed by field id
  const [form, setForm] = useState<Record<string, string | number | null>>({});

  const stats = useMemo(() => computeStats(rows), [rows]);

  const entryFields = fields;

  // Derived column ids that aren't in `fields` but appear on at least one row.
  const derivedColumnIds = useMemo(() => {
    const fieldIds = new Set(fields.map(f => f.id));
    const found = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r.values)) {
        if (!fieldIds.has(k)) {
          const v = r.values[k];
          if (v !== null && v !== undefined && v !== '') found.add(k);
        }
      }
    }
    return sortFieldIds(Array.from(found), (id) => fieldLabelFromCatalog(id) ?? undefined);
  }, [fields, rows]);

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

  const setVal = (id: string, v: string | number | null) =>
    setForm(prev => ({ ...prev, [id]: v }));

  const isFormValid = entryFields.every(f => {
    if (!f.required) return true;
    const v = form[f.id];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });

  const handleSaveTrade = () => {
    if (!isFormValid) return;
    addRow(form);
    setForm({});
    toast.success('Trade saved');
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

      {/* Add Field button */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" onClick={() => setFieldModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Field
        </Button>
      </div>

      {/* Inline trade entry */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        {entryFields.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            No fields configured. Click "Add Field" to insert fields for trade entry.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {entryFields.map((f) => (
                <FieldInput key={f.id} field={f} value={form[f.id]} onChange={(v) => setVal(f.id, v)} />
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSaveTrade} disabled={!isFormValid} className="gap-2">
                <Plus className="h-4 w-4" /> Save Trade
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Trades table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {fields.map((f) => (
                <th key={f.id} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  {f.label}
                </th>
              ))}
              {derivedColumnIds.map((id) => (
                <th key={id} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  {fieldLabelFromCatalog(id) ?? id}
                  <span className="ml-1 text-[10px] text-muted-foreground/70">(auto)</span>
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={fields.length + derivedColumnIds.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No trades yet. Fill the fields above and click "Save Trade" to log your first one.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  {fields.map((f) => (
                    <td key={f.id} className="px-4 py-3 whitespace-nowrap">{formatVal(r.values[f.id])}</td>
                  ))}
                  {derivedColumnIds.map((id) => (
                    <td key={id} className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatVal(r.values[id])}</td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditingRow(r)}
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
        fields={fields}
        onInsert={addField}
        onRemove={removeField}
      />

      {/* Edit-trade modal (only used when editing an existing row) */}
      <AddTradeModal
        open={!!editingRow}
        onOpenChange={(v) => { if (!v) setEditingRow(null); }}
        fields={fields}
        initialValues={editingRow?.values}
        isEditing={true}
        onSave={(values) => {
          if (editingRow) updateRow(editingRow.id, values);
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

const FieldInput = ({
  field, value, onChange,
}: {
  field: FieldDef;
  value: string | number | null | undefined;
  onChange: (v: string | number | null) => void;
}) => {
  const v = value;
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {field.type === 'text' && (
        <Input value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === 'number' && (
        <Input
          type="number"
          value={v === null || v === undefined ? '' : String(v)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )}
      {field.type === 'date' && (
        <AppDatePicker value={(v as string) ?? ''} onChange={(s) => onChange(s)} />
      )}
      {field.type === 'select' && (
        <Select value={(v as string) ?? ''} onValueChange={(val) => onChange(val)}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
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
