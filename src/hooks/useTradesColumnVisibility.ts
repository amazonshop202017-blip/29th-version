import { useState, useEffect, useCallback } from 'react';

export interface ColumnConfig {
  id: string;
  label: string;
  group: string;
  visible: boolean;
}

export interface ColumnGroup {
  id: string;
  label: string;
  columns: string[];
}

// Define all available columns with their groups
export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'identification',
    label: 'Trade Identification',
    columns: ['symbol', 'side', 'volume', 'ticksPips', 'accountName'],
  },
  {
    id: 'timing',
    label: 'Timing',
    columns: ['openDateTime', 'closeDateTime', 'duration'],
  },
  {
    id: 'execution',
    label: 'Execution & Plan',
    columns: ['avgEntry', 'avgExit', 'initialRisk', 'initialTarget'],
  },
  {
    id: 'performance',
    label: 'Performance',
    columns: ['grossPnl', 'netPnl', 'realizedRMultiple', 'plannedRRR'],
  },
  {
    id: 'priceMovement',
    label: 'Price Movement',
    columns: ['farthestProfitTicks', 'farthestLossTicks', 'postMaxTickPip', 'postMinTickPip'],
  },
];

export const ALL_COLUMNS: ColumnConfig[] = [
  // Trade Identification
  { id: 'symbol', label: 'Symbol', group: 'identification', visible: true },
  { id: 'side', label: 'Side', group: 'identification', visible: true },
  { id: 'volume', label: 'Volume', group: 'identification', visible: true },
  { id: 'ticksPips', label: 'Ticks / Pips', group: 'identification', visible: false },
  { id: 'accountName', label: 'Account Name', group: 'identification', visible: false },
  
  // Timing - consolidated columns
  { id: 'openDateTime', label: 'Open Date / Time', group: 'timing', visible: true },
  { id: 'closeDateTime', label: 'Close Date / Time', group: 'timing', visible: true },
  { id: 'duration', label: 'Duration', group: 'timing', visible: false },
  
  // Execution & Plan
  { id: 'avgEntry', label: 'Average Entry', group: 'execution', visible: false },
  { id: 'avgExit', label: 'Average Exit', group: 'execution', visible: false },
  { id: 'initialRisk', label: 'Initial Risk', group: 'execution', visible: false },
  { id: 'initialTarget', label: 'Initial Target', group: 'execution', visible: false },
  
  // Performance
  { id: 'grossPnl', label: 'Gross P&L', group: 'performance', visible: true },
  { id: 'netPnl', label: 'Net P&L', group: 'performance', visible: true },
  { id: 'realizedRMultiple', label: 'Realized R Multiple', group: 'performance', visible: true },
  { id: 'plannedRRR', label: 'Planned RR / R-Multiple', group: 'performance', visible: false },

  // Price Movement
  { id: 'farthestProfitTicks', label: 'MFE (pre-exit, ticks)', group: 'priceMovement', visible: false },
  { id: 'farthestLossTicks', label: 'MAE (pre-exit, ticks)', group: 'priceMovement', visible: false },
  { id: 'postMaxTickPip', label: 'Highest Price (Ticks)', group: 'priceMovement', visible: false },
  { id: 'postMinTickPip', label: 'Lowest Price (Ticks)', group: 'priceMovement', visible: false },
];

const STORAGE_KEY = 'trades-column-visibility';

export function useTradesColumnVisibility() {
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        return ALL_COLUMNS.map(col => ({
          ...col,
          visible: parsed[col.id] !== undefined ? parsed[col.id] : col.visible,
        }));
      }
    } catch (e) {
      console.error('Failed to load column visibility settings:', e);
    }
    return ALL_COLUMNS;
  });

  // Save to localStorage whenever columns change
  useEffect(() => {
    const visibility: Record<string, boolean> = {};
    columns.forEach(col => {
      visibility[col.id] = col.visible;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  }, [columns]);

  const toggleColumn = useCallback((columnId: string) => {
    setColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  }, []);

  const isColumnVisible = useCallback(
    (columnId: string) => {
      const col = columns.find(c => c.id === columnId);
      return col?.visible ?? false;
    },
    [columns]
  );

  const visibleColumns = columns.filter(col => col.visible);

  return {
    columns,
    toggleColumn,
    isColumnVisible,
    visibleColumns,
    columnGroups: COLUMN_GROUPS,
  };
}
