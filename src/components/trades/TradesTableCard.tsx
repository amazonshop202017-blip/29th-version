import { useState, useMemo, useEffect, useCallback, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Upload,
  GitMerge,
  Copy,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Menu,
  Star,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  type ColumnDef,
  type Header,
  type Cell,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useTradeModal } from '@/contexts/TradeModalContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics } from '@/types/trade';
import { cn } from '@/lib/utils';
import { TradesColumnSettings } from '@/components/trades/TradesColumnSettings';
import { useTradesColumnVisibility } from '@/hooks/useTradesColumnVisibility';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useCategoriesContext } from '@/contexts/CategoriesContext';
import { useTagsContext } from '@/contexts/TagsContext';
import { useTradesContext } from '@/contexts/TradesContext';
import { useStrategiesContext } from '@/contexts/StrategiesContext';
import { AssignTagsModal } from '@/components/trades/AssignTagsModal';
import { AccountImportModal } from '@/components/settings/AccountImportModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Trade } from '@/types/trade';

const formatDurationMinutes = (duration: string): string => {
  const match = duration.match(/(\d+) days (\d+) hours (\d+) mins/);
  if (!match) return duration;
  const [, days, hours, mins] = match;
  if (parseInt(days) > 0) return `${days}d ${hours}h`;
  if (parseInt(hours) > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const ORDER_STORAGE_KEY = 'tradesTable.columnOrder.v1';
const SIZING_STORAGE_KEY = 'tradesTable.columnSizing.v1';
const SORTING_STORAGE_KEY = 'tradesTable.columnSorting.v1';

// Initial display order of all data columns (the select & actions columns are fixed and rendered separately)
const DATA_COLUMN_IDS: string[] = [
  'symbol',
  'side',
  'volume',
  'ticksPips',
  'accountName',
  'openDateTime',
  'closeDateTime',
  'duration',
  'avgEntry',
  'avgExit',
  'initialRisk',
  'initialTarget',
  'strategy',
  'strategyChecklist',
  'grossPnl',
  'netPnl',
  'realizedRMultiple',
  'plannedRRR',
  'fees',
  'farthestProfitPrice',
  'farthestProfitTicks',
  'farthestLossPrice',
  'farthestLossTicks',
  'postMaxPrice',
  'postMaxTickPip',
  'postMinPrice',
  'postMinTickPip',
  'priceReachedFirst',
];

interface RowMeta {
  isPrivacyMode: boolean;
  maskCurrency: (value: number, formatter: (v: number) => string) => string;
  formatCurrency: (v: number) => string;
  accounts: { id: string; name: string }[];
  getStrategyById: (id: string) => { name: string } | undefined;
  classifyTradeOutcome: (
    netPnl: number,
    returnPercent: number,
    breakEven?: boolean,
  ) => string;
  tags: { id: string; name: string; categoryId: string }[];
  categoryColumns: { columnId: string; categoryId: string; name: string }[];
  onOpenTagModal: (trade: Trade) => void;
}

function DraggableTableHeader({
  header,
}: {
  header: Header<Trade, unknown>;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
    id: header.column.id,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    transform: CSS.Translate.toString(transform),
    transition: 'width transform 0.2s ease-in-out',
    whiteSpace: 'nowrap',
    width: `calc(var(--header-${header.id}-size) * 1px)`,
    zIndex: isDragging ? 1 : 0,
  };

  const isResizing = header.column.getIsResizing();
  const canSort = header.column.getCanSort();

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="group h-10 px-2 text-left align-middle font-medium text-muted-foreground text-sm bg-card"
    >
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => {
          if (canSort) {
            const handler = header.column.getToggleSortingHandler();
            handler?.(e);
          }
        }}
        className="flex items-center gap-1 cursor-grab active:cursor-grabbing select-none"
      >
        <span>
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {canSort && (
          <span className="inline-flex items-center text-muted-foreground/70">
            {{
              asc: <ArrowUp className="w-3.5 h-3.5 text-foreground" />,
              desc: <ArrowDown className="w-3.5 h-3.5 text-foreground" />,
            }[header.column.getIsSorted() as string] ?? (
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
            )}
          </span>
        )}
      </div>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          e.stopPropagation();
          header.getResizeHandler()(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          header.getResizeHandler()(e);
        }}
        onDoubleClick={() => header.column.resetSize()}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none z-10',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'after:content-[""] after:absolute after:top-1 after:bottom-1 after:right-0 after:w-0.5 after:bg-primary after:rounded-full',
          isResizing && 'opacity-100',
        )}
        aria-label="Resize column from right"
        role="separator"
      />
    </th>
  );
}

function DragAlongCell({ cell, hidden }: { cell: Cell<Trade, unknown>; hidden?: boolean }) {
  const { isDragging, setNodeRef, transform } = useSortable({
    id: cell.column.id,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    transform: CSS.Translate.toString(transform),
    transition: 'width transform 0.2s ease-in-out',
    width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <td
      ref={setNodeRef}
      style={style}
      className="px-2 py-1 align-middle overflow-hidden"
      onClick={(cell.column.columnDef.meta as { stopRowClick?: boolean } | undefined)?.stopRowClick ? (e) => e.stopPropagation() : undefined}
    >
      {hidden ? (
        <span className="text-muted-foreground select-none tracking-widest">***</span>
      ) : (
        flexRender(cell.column.columnDef.cell, cell.getContext())
      )}
    </td>
  );
}

export interface TradesTableCardProps {
  trades: Trade[];
  showImport?: boolean;
  emptyState?: { title: string; subtitle: string };
  className?: string;
}

export const TradesTableCard = ({
  trades,
  showImport = true,
  emptyState,
  className,
}: TradesTableCardProps) => {
  const { deleteTrades, bulkAddTrades } = useFilteredTrades();
  const { openModal } = useTradeModal();
  const { accounts } = useAccountsContext();
  const { formatCurrency, classifyTradeOutcome } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency } = usePrivacyMode();
  const { categories } = useCategoriesContext();
  const { tags } = useTagsContext();
  const { updateTrade, trades: allTrades, toggleStarred } = useTradesContext();
  const { getStrategyById, strategies } = useStrategiesContext();
  const { columns: visibilityColumns, toggleColumn, isColumnVisible, columnGroups } =
    useTradesColumnVisibility(categories);

  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tradesPerPage, setTradesPerPage] = useState(50);
  const [tagModalTrade, setTagModalTrade] = useState<Trade | null>(null);

  const HIDDEN_STORAGE_KEY = 'tradesTable.hiddenTradeIds';
  const [hiddenTradeIds, setHiddenTradeIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(HIDDEN_STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(Array.from(hiddenTradeIds)));
    } catch {
      // ignore
    }
  }, [hiddenTradeIds]);
  const toggleHidden = useCallback((id: string) => {
    setHiddenTradeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleOpenTagModal = useCallback((trade: Trade) => {
    setTagModalTrade(trade);
  }, []);

  const handleTagsChange = useCallback(
    (tagIds: string[]) => {
      if (tagModalTrade) {
        updateTrade(tagModalTrade.id, { ...tagModalTrade, tags: tagIds });
      }
    },
    [tagModalTrade, updateTrade],
  );

  // Visible category columns (in category order)
  const categoryColumns = useMemo(() => {
    return categories
      .map((cat) => {
        const columnId = `category:${cat.id}`;
        return isColumnVisible(columnId)
          ? { columnId, categoryId: cat.id, name: cat.name }
          : null;
      })
      .filter(
        (c): c is { columnId: string; categoryId: string; name: string } => c !== null,
      );
  }, [categories, isColumnVisible]);

  // All possible category column ids (for column-order management, regardless of visibility)
  const allCategoryColumnIds = useMemo(
    () => categories.map((cat) => `category:${cat.id}`),
    [categories],
  );

  // Build full TanStack column registry
  const columns = useMemo<ColumnDef<Trade>[]>(() => {
    const dataCols: ColumnDef<Trade>[] = [
      {
        id: 'symbol',
        header: 'Symbol',
        accessorFn: (row) => row.symbol,
        size: 110,
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.symbol}</span>
        ),
      },
      {
        id: 'side',
        header: 'Side',
        accessorFn: (row) => row.side,
        size: 100,
        cell: ({ row }) => (
          <div
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
              row.original.side === 'LONG'
                ? 'bg-profit/20 text-profit'
                : 'bg-loss/20 text-loss',
            )}
          >
            {row.original.side === 'LONG' ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {row.original.side}
          </div>
        ),
      },
      {
        id: 'volume',
        header: 'Volume',
        accessorFn: (row) => calculateTradeMetrics(row).totalQuantity,
        size: 90,
        cell: ({ row }) => (
          <span className="font-mono">
            {calculateTradeMetrics(row.original).totalQuantity}
          </span>
        ),
      },
      {
        id: 'ticksPips',
        header: 'Ticks/Pips',
        size: 100,
        enableSorting: false,
        cell: () => <span className="text-muted-foreground">—</span>,
      },
      {
        id: 'accountName',
        header: 'Account',
        accessorFn: (row) => {
          const meta = (row as Trade & { __meta?: RowMeta }).__meta;
          return meta?.accounts.find((a) => a.id === row.accountId)?.name ?? '';
        },
        size: 130,
        cell: ({ row, table }) => {
          const meta = table.options.meta as RowMeta;
          return (
            <span className="text-muted-foreground">
              {row.original.accountId
                ? meta.accounts.find((a) => a.id === row.original.accountId)?.name ?? '—'
                : '—'}
            </span>
          );
        },
      },
      {
        id: 'openDateTime',
        header: 'Open Date / Time',
        accessorFn: (row) => {
          const d = calculateTradeMetrics(row).openDate;
          return d ? new Date(d).getTime() : 0;
        },
        size: 170,
        cell: ({ row }) => {
          const d = calculateTradeMetrics(row.original).openDate;
          return (
            <span className="text-muted-foreground text-xs">
              {d ? format(new Date(d), 'MMM dd, yyyy HH:mm') : '—'}
            </span>
          );
        },
      },
      {
        id: 'closeDateTime',
        header: 'Close Date / Time',
        accessorFn: (row) => {
          const d = calculateTradeMetrics(row).closeDate;
          return d ? new Date(d).getTime() : 0;
        },
        size: 170,
        cell: ({ row }) => {
          const d = calculateTradeMetrics(row.original).closeDate;
          return (
            <span className="text-muted-foreground text-xs">
              {d ? format(new Date(d), 'MMM dd, yyyy HH:mm') : '—'}
            </span>
          );
        },
      },
      {
        id: 'duration',
        header: 'Duration',
        accessorFn: (row) => calculateTradeMetrics(row).durationMinutes,
        size: 100,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDurationMinutes(calculateTradeMetrics(row.original).duration)}
          </span>
        ),
      },
      {
        id: 'avgEntry',
        header: 'Avg Entry',
        accessorFn: (row) => calculateTradeMetrics(row).avgEntryPrice,
        size: 100,
        cell: ({ row }) => {
          const v = calculateTradeMetrics(row.original).avgEntryPrice;
          return <span className="font-mono">{v > 0 ? v.toFixed(2) : '—'}</span>;
        },
      },
      {
        id: 'avgExit',
        header: 'Avg Exit',
        accessorFn: (row) => calculateTradeMetrics(row).avgExitPrice,
        size: 100,
        cell: ({ row }) => {
          const v = calculateTradeMetrics(row.original).avgExitPrice;
          return <span className="font-mono">{v > 0 ? v.toFixed(2) : '—'}</span>;
        },
      },
      {
        id: 'initialRisk',
        header: 'Stop Loss',
        accessorFn: (row) => row.stopLoss ?? null,
        size: 110,
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.stopLoss !== undefined && row.original.stopLoss !== null
              ? row.original.stopLoss.toFixed(2)
              : '—'}
          </span>
        ),
      },
      {
        id: 'initialTarget',
        header: 'Take Profit',
        accessorFn: (row) => row.takeProfit ?? null,
        size: 110,
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.takeProfit !== undefined && row.original.takeProfit !== null
              ? row.original.takeProfit.toFixed(2)
              : '—'}
          </span>
        ),
      },
      {
        id: 'strategy',
        header: 'Strategy',
        accessorFn: (row) => row.strategyId ?? '',
        size: 130,
        cell: ({ row, table }) => {
          const meta = table.options.meta as RowMeta;
          return (
            <span className="text-muted-foreground">
              {row.original.strategyId
                ? meta.getStrategyById(row.original.strategyId)?.name ?? '—'
                : '—'}
            </span>
          );
        },
      },
      {
        id: 'strategyChecklist',
        header: 'Strategy (Checklist)',
        size: 180,
        enableSorting: false,
        cell: ({ row }) => {
          const items = row.original.selectedChecklistItems ?? [];
          if (items.length === 0)
            return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <div className="flex items-center gap-1.5">
              {items.slice(0, 2).map((item, idx) => (
                <Badge key={`${item}-${idx}`} variant="outline" className="text-xs">
                  {item}
                </Badge>
              ))}
              {items.length > 2 && (
                <span className="text-xs text-muted-foreground">+{items.length - 2}</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'grossPnl',
        header: 'Gross P&L',
        accessorFn: (row) => calculateTradeMetrics(row).grossPnl,
        size: 110,
        cell: ({ row, table }) => {
          const meta = table.options.meta as RowMeta;
          const m = calculateTradeMetrics(row.original);
          return (
            <span
              className={cn(
                'font-mono font-semibold',
                meta.isPrivacyMode
                  ? 'text-foreground'
                  : m.grossPnl >= 0
                    ? 'text-profit'
                    : 'text-loss',
              )}
            >
              {meta.maskCurrency(m.grossPnl, meta.formatCurrency)}
            </span>
          );
        },
      },
      {
        id: 'netPnl',
        header: 'Net P&L',
        accessorFn: (row) => calculateTradeMetrics(row).netPnl,
        size: 110,
        cell: ({ row, table }) => {
          const meta = table.options.meta as RowMeta;
          const m = calculateTradeMetrics(row.original);
          return (
            <span
              className={cn(
                'font-mono font-semibold',
                meta.isPrivacyMode
                  ? 'text-foreground'
                  : m.netPnl >= 0
                    ? 'text-profit'
                    : 'text-loss',
              )}
            >
              {meta.maskCurrency(m.netPnl, meta.formatCurrency)}
            </span>
          );
        },
      },
      {
        id: 'realizedRMultiple',
        header: 'R Multiple',
        accessorFn: (row) => {
          const trade = row;
          const metrics = calculateTradeMetrics(trade);
          if (typeof trade.savedRMultiple === 'number' && trade.savedRMultiple !== 0) {
            return trade.savedRMultiple;
          }
          if (
            metrics.avgEntryPrice > 0 &&
            metrics.avgExitPrice > 0 &&
            trade.stopLoss &&
            trade.stopLoss > 0
          ) {
            const entry = metrics.avgEntryPrice;
            const exit = metrics.avgExitPrice;
            const sl = trade.stopLoss;
            const risk = trade.side === 'LONG' ? entry - sl : sl - entry;
            const realizedPnl = trade.side === 'LONG' ? exit - entry : entry - exit;
            if (risk > 0) return realizedPnl / risk;
          }
          return null;
        },
        size: 100,
        cell: ({ row }) => {
          const trade = row.original;
          const metrics = calculateTradeMetrics(trade);
          let rMultiple: number | null = null;
          if (typeof trade.savedRMultiple === 'number' && trade.savedRMultiple !== 0) {
            rMultiple = trade.savedRMultiple;
          } else if (
            metrics.avgEntryPrice > 0 &&
            metrics.avgExitPrice > 0 &&
            trade.stopLoss &&
            trade.stopLoss > 0
          ) {
            const entry = metrics.avgEntryPrice;
            const exit = metrics.avgExitPrice;
            const sl = trade.stopLoss;
            const risk = trade.side === 'LONG' ? entry - sl : sl - entry;
            const realizedPnl = trade.side === 'LONG' ? exit - entry : entry - exit;
            if (risk > 0) rMultiple = realizedPnl / risk;
          }
          return (
            <span className="font-mono text-foreground">
              {rMultiple !== null ? rMultiple.toFixed(2) : '—'}
            </span>
          );
        },
      },
      {
        id: 'plannedRRR',
        header: 'Planned RR',
        accessorFn: (row) => row.savedRRR ?? null,
        size: 110,
        cell: ({ row }) => (
          <span className="font-mono text-foreground">
            {typeof row.original.savedRRR === 'number'
              ? row.original.savedRRR.toFixed(2)
              : '—'}
          </span>
        ),
      },
      {
        id: 'fees',
        header: 'Fees',
        accessorFn: (row) => calculateTradeMetrics(row).totalCharges,
        size: 100,
        cell: ({ row, table }) => {
          const meta = table.options.meta as RowMeta;
          const m = calculateTradeMetrics(row.original);
          return (
            <span
              className={cn(
                'font-mono',
                meta.isPrivacyMode ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {meta.maskCurrency(m.totalCharges, meta.formatCurrency)}
            </span>
          );
        },
      },
      {
        id: 'farthestProfitPrice',
        header: 'MFE (pre-exit, price)',
        accessorFn: (row) => row.preMfePrice ?? null,
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-right block">
            {typeof row.original.preMfePrice === 'number' ? row.original.preMfePrice : ''}
          </span>
        ),
      },
      {
        id: 'farthestProfitTicks',
        header: 'MFE (pre-exit, ticks)',
        accessorFn: (row) => row.preMfeTickPip ?? null,
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-right block">
            {typeof row.original.preMfeTickPip === 'number' ? row.original.preMfeTickPip : ''}
          </span>
        ),
      },
      {
        id: 'farthestLossPrice',
        header: 'MAE (pre-exit, price)',
        accessorFn: (row) => row.preMaePrice ?? null,
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-right block">
            {typeof row.original.preMaePrice === 'number' ? row.original.preMaePrice : ''}
          </span>
        ),
      },
      {
        id: 'farthestLossTicks',
        header: 'MAE (pre-exit, ticks)',
        accessorFn: (row) => row.preMaeTickPip ?? null,
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-right block">
            {typeof row.original.preMaeTickPip === 'number' ? row.original.preMaeTickPip : ''}
          </span>
        ),
      },
      {
        id: 'postMaxPrice',
        header: 'Highest Price (Price)',
        accessorFn: (row) => row.postMaxPrice ?? null,
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-right block">
            {typeof row.original.postMaxPrice === 'number' ? row.original.postMaxPrice : ''}
          </span>
        ),
      },
      {
        id: 'postMaxTickPip',
        header: 'Highest Price (Ticks)',
        accessorFn: (row) => row.postMaxTickPip ?? null,
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-right block">
            {typeof row.original.postMaxTickPip === 'number' ? row.original.postMaxTickPip : ''}
          </span>
        ),
      },
      {
        id: 'postMinPrice',
        header: 'Lowest Price (Price)',
        accessorFn: (row) => row.postMinPrice ?? null,
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-right block">
            {typeof row.original.postMinPrice === 'number' ? row.original.postMinPrice : ''}
          </span>
        ),
      },
      {
        id: 'postMinTickPip',
        header: 'Lowest Price (Ticks)',
        accessorFn: (row) => row.postMinTickPip ?? null,
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-right block">
            {typeof row.original.postMinTickPip === 'number' ? row.original.postMinTickPip : ''}
          </span>
        ),
      },
      {
        id: 'priceReachedFirst',
        header: 'Reached First',
        size: 120,
        enableSorting: false,
        cell: ({ row }) => {
          const v = row.original.priceReachedFirst;
          if (v === 'takeProfit')
            return (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-profit/20 text-profit">
                TP
              </span>
            );
          if (v === 'stopLoss')
            return (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-loss/20 text-loss">
                SL
              </span>
            );
          return <span className="text-muted-foreground text-xs">—</span>;
        },
      },
    ];

    // Dynamic category columns
    const catCols: ColumnDef<Trade>[] = categories.map((cat) => ({
      id: `category:${cat.id}`,
      header: cat.name,
      size: 160,
      enableSorting: false,
      meta: { stopRowClick: true },
      cell: ({ row, table }) => {
        const meta = table.options.meta as RowMeta;
        const tradeTagIds = row.original.tags ?? [];
        const tagsInCategory = tradeTagIds
          .map((id) => meta.tags.find((t) => t.id === id))
          .filter(
            (t): t is { id: string; name: string; categoryId: string } =>
              !!t && t.categoryId === cat.id,
          );
        return (
          <div className="flex items-center gap-1.5">
            {tagsInCategory.slice(0, 2).map((tag) => (
              <Badge key={tag.id} variant="outline" className="text-xs">
                {tag.name}
              </Badge>
            ))}
            {tagsInCategory.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{tagsInCategory.length - 2}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                meta.onOpenTagModal(row.original);
              }}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
              aria-label="Manage tags"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        );
      },
    }));

    return [...dataCols, ...catCols];
  }, [categories]);

  // Column visibility map for TanStack
  const columnVisibility = useMemo<VisibilityState>(() => {
    const map: VisibilityState = {};
    for (const id of DATA_COLUMN_IDS) {
      map[id] = isColumnVisible(id);
    }
    for (const id of allCategoryColumnIds) {
      map[id] = isColumnVisible(id);
    }
    return map;
  }, [isColumnVisible, allCategoryColumnIds]);

  // Column order — persisted, includes both data + category ids
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [...DATA_COLUMN_IDS];
    try {
      const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
      if (!raw) return [...DATA_COLUMN_IDS];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [...DATA_COLUMN_IDS];
    } catch {
      return [...DATA_COLUMN_IDS];
    }
  });

  // Reconcile order when categories change or unknown ids exist
  useEffect(() => {
    setColumnOrder((prev) => {
      const allIds = [...DATA_COLUMN_IDS, ...allCategoryColumnIds];
      const knownPrev = prev.filter((id) => allIds.includes(id));
      const missing = allIds.filter((id) => !knownPrev.includes(id));
      const next = [...knownPrev, ...missing];
      // avoid unnecessary state churn
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [allCategoryColumnIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(columnOrder));
    } catch {
      /* ignore */
    }
  }, [columnOrder]);

  // Column sizing
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(SIZING_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as ColumnSizingState) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SIZING_STORAGE_KEY, JSON.stringify(columnSizing));
    } catch {
      /* ignore */
    }
  }, [columnSizing]);

  // Sorting — default: closeDate desc (matches previous sortedTrades behavior)
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (typeof window === 'undefined') return [{ id: 'closeDateTime', desc: true }];
    try {
      const raw = window.localStorage.getItem(SORTING_STORAGE_KEY);
      if (!raw) return [{ id: 'closeDateTime', desc: true }];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? (parsed as SortingState)
        : [{ id: 'closeDateTime', desc: true }];
    } catch {
      return [{ id: 'closeDateTime', desc: true }];
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify(sorting));
    } catch {
      /* ignore */
    }
  }, [sorting]);

  const tableMeta: RowMeta = useMemo(
    () => ({
      isPrivacyMode,
      maskCurrency,
      formatCurrency,
      accounts,
      getStrategyById,
      classifyTradeOutcome,
      tags,
      categoryColumns,
      onOpenTagModal: handleOpenTagModal,
    }),
    [
      isPrivacyMode,
      maskCurrency,
      formatCurrency,
      accounts,
      getStrategyById,
      classifyTradeOutcome,
      tags,
      categoryColumns,
      handleOpenTagModal,
    ],
  );

  const table = useReactTable({
    data: trades,
    columns,
    state: { columnOrder, columnSizing, sorting, columnVisibility },
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60, maxSize: 600 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    meta: tableMeta,
  });

  const sortedRows = table.getRowModel().rows;
  const totalTrades = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalTrades / tradesPerPage));
  const startIndex = (currentPage - 1) * tradesPerPage;
  const endIndex = Math.min(startIndex + tradesPerPage, totalTrades);
  const pageRows = sortedRows.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const allSelected =
    pageRows.length > 0 && pageRows.every((r) => selectedTrades.has(r.original.id));
  const someSelected = selectedTrades.size > 0;

  const handleSelectAll = () => {
    setSelectedTrades((prev) => {
      const next = new Set(prev);
      if (allSelected) pageRows.forEach((r) => next.delete(r.original.id));
      else pageRows.forEach((r) => next.add(r.original.id));
      return next;
    });
  };

  const handleTradesPerPageChange = (value: string) => {
    setTradesPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleRowClick = (tradeId: string) => {
    const trade = trades.find((t) => t.id === tradeId);
    if (trade) openModal(trade);
  };

  const handleDeleteSelected = () => {
    const idsToDelete = Array.from(selectedTrades);
    setSelectedTrades(new Set());
    setDeleteDialogOpen(false);
    deleteTrades(idsToDelete);
  };

  const handleDuplicateSelected = () => {
    if (selectedTrades.size === 0) return;
    const tradesToDuplicate = trades.filter((t) => selectedTrades.has(t.id));
    const duplicatedTradesData = tradesToDuplicate.map((trade) => {
      const { id, createdAt, updatedAt, fingerprint, source, ...tradeData } = trade;
      return { ...tradeData, source: 'manual' as const };
    });
    bulkAddTrades(duplicatedTradesData);
    setSelectedTrades(new Set());
  };

  // CSS vars for buttery resizing — keyed on sizing/order to recompute when they change
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: Record<string, number> = {};
    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnSizingInfo, table.getState().columnSizing, columnOrder, columnVisibility]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, {}),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((order) => {
        const oldIndex = order.indexOf(active.id as string);
        const newIndex = order.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return order;
        return arrayMove(order, oldIndex, newIndex);
      });
    }
  };

  const headerGroup = table.getHeaderGroups()[0];
  const visibleHeaders = headerGroup?.headers ?? [];
  const visibleColumnIds = visibleHeaders.map((h) => h.column.id);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          'glass-card rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden',
          className,
        )}
      >
        {/* Action Bar */}
        <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant={someSelected ? 'default' : 'outline'}
              size="sm"
              onClick={handleSelectAll}
              className="gap-1.5 text-xs md:text-sm"
            >
              {someSelected ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Deselect</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span className="hidden sm:inline">Select All</span>
                </>
              )}
            </Button>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs md:text-sm text-destructive hover:text-destructive"
                disabled={selectedTrades.size === 0}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span> ({selectedTrades.size})
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Selected Trades</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedTrades.size} selected trade
                    {selectedTrades.size > 1 ? 's' : ''}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteSelected}
                    className="bg-loss hover:bg-loss/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {showImport && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hidden lg:inline-flex"
                onClick={() => setImportModalOpen(true)}
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden lg:inline-flex"
              disabled={selectedTrades.size < 2}
            >
              <GitMerge className="w-4 h-4" />
              Merge
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden lg:inline-flex"
              disabled={selectedTrades.size === 0}
              onClick={handleDuplicateSelected}
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {showImport && (
                  <DropdownMenuItem onClick={() => setImportModalOpen(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={selectedTrades.size < 2}>
                  <GitMerge className="w-4 h-4 mr-2" />
                  Merge
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selectedTrades.size === 0}
                  onClick={handleDuplicateSelected}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1">
            <TradesColumnSettings
              columns={visibilityColumns}
              columnGroups={columnGroups}
              onToggleColumn={toggleColumn}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-accent-foreground"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    const { exportTradesToCsv, downloadTradesCsv } = await import(
                      '@/lib/tradeValleyCsv'
                    );
                    const csv = exportTradesToCsv(allTrades, strategies, tags, categories);
                    const date = format(new Date(), 'yyyy-MM-dd');
                    downloadTradesCsv(csv, `tradevalley-trades-${date}.csv`);
                  }}
                >
                  Export All Trades
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Table */}
        {pageRows.length === 0 ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">{emptyState?.title ?? 'No trades recorded yet'}</p>
              <p className="text-sm mt-1">
                {emptyState?.subtitle ??
                  'Click "Enter Trade" or the + button to add your first trade'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div
              className="flex-1 min-h-0 overflow-auto"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
            >
              <DndContext
                collisionDetection={closestCenter}
                modifiers={[restrictToHorizontalAxis]}
                onDragEnd={handleDragEnd}
                sensors={sensors}
              >
                <table
                  className="min-w-full caption-bottom text-sm border-collapse"
                  style={{ ...columnSizeVars, width: table.getTotalSize() + 122 }}
                >
                  <thead className="sticky top-0 bg-card z-10 border-b border-border">
                    <tr className="border-b border-border">
                      <th className="w-8 px-2 h-10 align-middle bg-card">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all trades on this page"
                        />
                      </th>
                      <th className="w-[90px] px-1 h-10 align-middle bg-card" />
                      <SortableContext
                        items={visibleColumnIds}
                        strategy={horizontalListSortingStrategy}
                      >
                        {visibleHeaders.map((header) => (
                          <DraggableTableHeader key={header.id} header={header} />
                        ))}
                      </SortableContext>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const trade = row.original;
                      const metrics = calculateTradeMetrics(trade);
                      const isSelected = selectedTrades.has(trade.id);
                      const outcome = classifyTradeOutcome(
                        metrics.netPnl,
                        trade.savedReturnPercent ?? metrics.returnPercent,
                        trade.breakEven,
                      );
                      const isProfit = outcome === 'win';
                      const isLoss = outcome === 'loss';

                      return (
                        <tr
                          key={row.id}
                          onClick={() => handleRowClick(trade.id)}
                          className={cn(
                            'border-b border-border cursor-pointer h-10 transition-colors',
                            isSelected
                              ? 'bg-secondary/50'
                              : isProfit
                                ? 'bg-profit/[0.07] hover:bg-profit/[0.12]'
                                : isLoss
                                  ? 'bg-loss/[0.07] hover:bg-loss/[0.12]'
                                  : 'bg-[#fcf9ff] dark:bg-[hsl(270,10%,14%)] hover:bg-[#f5f0fc] dark:hover:bg-[hsl(270,10%,17%)]',
                          )}
                        >
                          <td
                            className="w-8 px-2 py-1 align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setSelectedTrades((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(trade.id);
                                  else next.delete(trade.id);
                                  return next;
                                });
                              }}
                              aria-label={`Select trade ${trade.symbol}`}
                            />
                          </td>
                          <td
                            className="w-[90px] px-1 py-1 align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleStarred(trade.id); }}
                                aria-pressed={!!trade.starred}
                                aria-label={trade.starred ? `Unstar trade ${trade.symbol}` : `Star trade ${trade.symbol}`}
                                className={cn(
                                  "p-1 rounded hover:bg-muted/50 transition-colors",
                                  trade.starred ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"
                                )}
                              >
                                <Star className="w-3.5 h-3.5" fill={trade.starred ? "currentColor" : "none"} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleHidden(trade.id); }}
                                aria-pressed={hiddenTradeIds.has(trade.id)}
                                aria-label={hiddenTradeIds.has(trade.id) ? `Show values for ${trade.symbol}` : `Hide values for ${trade.symbol}`}
                                className={cn(
                                  "p-1 rounded hover:bg-muted/50 transition-colors",
                                  hiddenTradeIds.has(trade.id) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {hiddenTradeIds.has(trade.id) ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <SortableContext
                            items={visibleColumnIds}
                            strategy={horizontalListSortingStrategy}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <DragAlongCell key={cell.id} cell={cell} hidden={hiddenTradeIds.has(trade.id)} />
                            ))}
                          </SortableContext>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DndContext>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalTrades > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-2 border-t border-border flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                  Per page:
                </span>
                <Select
                  value={String(tradesPerPage)}
                  onValueChange={handleTradesPerPageChange}
                >
                  <SelectTrigger className="w-[56px] sm:w-[70px] h-7 sm:h-8 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="75">75</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                {startIndex + 1}–{endIndex} of {totalTrades}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <Select
                value={String(currentPage)}
                onValueChange={(v) => setCurrentPage(Number(v))}
              >
                <SelectTrigger className="w-[50px] sm:w-[60px] h-7 sm:h-8 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <SelectItem key={page} value={String(page)}>
                      {page}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                of {totalPages}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {showImport && (
        <AccountImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />
      )}

      {tagModalTrade && (
        <AssignTagsModal
          isOpen={!!tagModalTrade}
          onClose={() => setTagModalTrade(null)}
          selectedTagIds={tagModalTrade.tags || []}
          onTagsChange={handleTagsChange}
          symbol={tagModalTrade.symbol}
          entryDate={calculateTradeMetrics(tagModalTrade).openDate}
        />
      )}
    </>
  );
};

export default TradesTableCard;
