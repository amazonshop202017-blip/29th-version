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
} from '@/lib/backtestStore';

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
    persistFields([...fields, field]);
  }, [fields, persistFields]);

  const removeField = useCallback((id: string) => {
    persistFields(fields.filter(f => f.id !== id));
  }, [fields, persistFields]);

  const addRow = useCallback((values: Record<string, string | number | null>) => {
    const row: BacktestRow = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      values,
    };
    persistRows([...rows, row]);
  }, [rows, persistRows]);

  const updateRow = useCallback((id: string, values: Record<string, string | number | null>) => {
    persistRows(rows.map(r => r.id === id ? { ...r, values } : r));
  }, [rows, persistRows]);

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