import { useCallback, useEffect, useState } from 'react';
import {
  BacktestRow,
  FieldDef,
  loadFields,
  loadRows,
  saveFields,
  saveRows,
  clearRows as clearRowsStore,
  clearSession as clearSessionStore,
  getDerivedFieldIds,
  applyDerivations,
  fieldLabelFromCatalog,
} from '@/lib/backtestStore';
import { toast } from 'sonner';

export function useBacktestSession(accountId: string | undefined) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [rows, setRows] = useState<BacktestRow[]>([]);

  useEffect(() => {
    if (!accountId) return;
    setFields(loadFields(accountId));
    setRows(loadRows(accountId));
  }, [accountId]);

  const persistFields = useCallback((next: FieldDef[]) => {
    if (!accountId) return;
    saveFields(accountId, next);
    setFields(next);
  }, [accountId]);

  const persistRows = useCallback((next: BacktestRow[]) => {
    if (!accountId) return;
    saveRows(accountId, next);
    setRows(next);
  }, [accountId]);

  const addField = useCallback((field: FieldDef) => {
    const next = [...fields, field];
    const ids = next.map(f => f.id);
    const derived = new Set(getDerivedFieldIds(ids));
    // Don't auto-remove the field the user just inserted (manual override)
    derived.delete(field.id);
    if (derived.size > 0) {
      const cleaned = next.filter(f => !derived.has(f.id));
      derived.forEach(id => {
        const label = fieldLabelFromCatalog(id) ?? id;
        toast.info(`${label} is now auto-calculated from selected fields.`);
      });
      persistFields(cleaned);
    } else {
      persistFields(next);
    }
  }, [fields, persistFields]);

  const removeField = useCallback((id: string) => {
    persistFields(fields.filter(f => f.id !== id));
  }, [fields, persistFields]);

  const addRow = useCallback((values: Record<string, string | number | null>) => {
    const ids = fields.map(f => f.id);
    const enriched = applyDerivations(ids, values) as Record<string, string | number | null>;
    const row: BacktestRow = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      values: enriched,
    };
    persistRows([...rows, row]);
  }, [fields, rows, persistRows]);

  const updateRow = useCallback((id: string, values: Record<string, string | number | null>) => {
    const ids = fields.map(f => f.id);
    const enriched = applyDerivations(ids, values) as Record<string, string | number | null>;
    persistRows(rows.map(r => r.id === id ? { ...r, values: enriched } : r));
  }, [fields, rows, persistRows]);

  const deleteRow = useCallback((id: string) => {
    persistRows(rows.filter(r => r.id !== id));
  }, [rows, persistRows]);

  const clearRows = useCallback(() => {
    if (!accountId) return;
    clearRowsStore(accountId);
    setRows([]);
  }, [accountId]);

  const clearAll = useCallback(() => {
    if (!accountId) return;
    clearSessionStore(accountId);
    setFields(loadFields(accountId));
    setRows([]);
  }, [accountId]);

  return { fields, rows, addField, removeField, addRow, updateRow, deleteRow, clearRows, clearAll };
}