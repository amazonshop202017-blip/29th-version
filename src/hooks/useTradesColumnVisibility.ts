import { useState, useEffect, useCallback, useMemo } from 'react';

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
    columns: ['grossPnl', 'netPnl', 'realizedRMultiple', 'plannedRRR', 'fees'],
  },
  {
    id: 'priceMovement',
    label: 'Price Movement',
    columns: ['farthestProfitPrice', 'farthestProfitTicks', 'farthestLossPrice', 'farthestLossTicks', 'postMaxPrice', 'postMaxTickPip', 'postMinPrice', 'postMinTickPip'],
  },
];

export const TAG_CATEGORIES_GROUP_ID = 'tagCategories';
export const CATEGORY_COLUMN_PREFIX = 'category:';

export const buildCategoryColumnId = (categoryId: string) =>
  `${CATEGORY_COLUMN_PREFIX}${categoryId}`;

export const isCategoryColumnId = (columnId: string) =>
  columnId.startsWith(CATEGORY_COLUMN_PREFIX);

export const getCategoryIdFromColumnId = (columnId: string): string | null =>
  isCategoryColumnId(columnId) ? columnId.slice(CATEGORY_COLUMN_PREFIX.length) : null;

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
  { id: 'fees', label: 'Fees', group: 'performance', visible: false },

  // Price Movement
  { id: 'farthestProfitPrice', label: 'MFE (pre-exit, price)', group: 'priceMovement', visible: false },
  { id: 'farthestProfitTicks', label: 'MFE (pre-exit, ticks)', group: 'priceMovement', visible: false },
  { id: 'farthestLossPrice', label: 'MAE (pre-exit, price)', group: 'priceMovement', visible: false },
  { id: 'farthestLossTicks', label: 'MAE (pre-exit, ticks)', group: 'priceMovement', visible: false },
  { id: 'postMaxPrice', label: 'Highest Price (Price)', group: 'priceMovement', visible: false },
  { id: 'postMaxTickPip', label: 'Highest Price (Ticks)', group: 'priceMovement', visible: false },
  { id: 'postMinPrice', label: 'Lowest Price (Price)', group: 'priceMovement', visible: false },
  { id: 'postMinTickPip', label: 'Lowest Price (Ticks)', group: 'priceMovement', visible: false },
];

const STORAGE_KEY = 'trades-column-visibility';

interface CategoryLike {
  id: string;
  name: string;
}

export function useTradesColumnVisibility(categories: CategoryLike[] = []) {
  // Stored visibility map (id -> visible)
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as Record<string, boolean>;
      }
    } catch (e) {
      console.error('Failed to load column visibility settings:', e);
    }
    return {};
  });

  // Persist whenever visibility changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  }, [visibility]);

  // Build dynamic category columns from current categories
  const categoryColumns = useMemo<ColumnConfig[]>(
    () =>
      categories.map((cat) => ({
        id: buildCategoryColumnId(cat.id),
        label: cat.name,
        group: TAG_CATEGORIES_GROUP_ID,
        visible: false, // default off
      })),
    [categories]
  );

  // Merge static + dynamic columns and apply persisted visibility
  const columns = useMemo<ColumnConfig[]>(() => {
    const merged = [...ALL_COLUMNS, ...categoryColumns];
    return merged.map((col) => ({
      ...col,
      visible: visibility[col.id] !== undefined ? visibility[col.id] : col.visible,
    }));
  }, [categoryColumns, visibility]);

  // Build column groups; only include the tag-categories group when there is at least one category
  const columnGroups = useMemo<ColumnGroup[]>(() => {
    if (categoryColumns.length === 0) return COLUMN_GROUPS;
    return [
      ...COLUMN_GROUPS,
      {
        id: TAG_CATEGORIES_GROUP_ID,
        label: 'Custom Tag Categories',
        columns: categoryColumns.map((c) => c.id),
      },
    ];
  }, [categoryColumns]);

  const toggleColumn = useCallback((columnId: string) => {
    setVisibility((prev) => {
      // Look up current effective visibility (fallback to column default)
      const currentDefault =
        ALL_COLUMNS.find((c) => c.id === columnId)?.visible ??
        // category columns default to false
        false;
      const current = prev[columnId] !== undefined ? prev[columnId] : currentDefault;
      return { ...prev, [columnId]: !current };
    });
  }, []);

  const isColumnVisible = useCallback(
    (columnId: string) => {
      const col = columns.find((c) => c.id === columnId);
      return col?.visible ?? false;
    },
    [columns]
  );

  const visibleColumns = useMemo(() => columns.filter((col) => col.visible), [columns]);

  return {
    columns,
    toggleColumn,
    isColumnVisible,
    visibleColumns,
    columnGroups,
  };
}
