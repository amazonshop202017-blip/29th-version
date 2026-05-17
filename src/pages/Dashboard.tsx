import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useDashboardEdit } from '@/contexts/DashboardEditContext';
import { AddWidgetPlaceholder } from '@/components/dashboard/AddWidgetPlaceholder';
import { ChartLibraryModal } from '@/components/dashboard/ChartLibraryModal';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { RecentTrades } from '@/components/dashboard/RecentTrades';
import { DailyCumulativePnLChart } from '@/components/dashboard/DailyCumulativePnLChart';
import { NetDailyPnLChart } from '@/components/dashboard/NetDailyPnLChart';
import { TradeTimePerformanceChart } from '@/components/dashboard/TradeTimePerformanceChart';
import { TradeDurationPerformanceChart } from '@/components/dashboard/TradeDurationPerformanceChart';
import { MonthlyPerformanceCalendar } from '@/components/dashboard/MonthlyPerformanceCalendar';
import { YearlyCalendarWidget } from '@/components/dashboard/YearlyCalendarWidget';
import { ForexNewsKpi } from '@/components/dashboard/ForexNewsKpi';
import { SymbolAnalysisChart } from '@/components/dashboard/InstrumentAnalysisChart';
import { LongShortAnalysisChart } from '@/components/dashboard/LongShortAnalysisChart';
import { ExternalLinksWidget } from '@/components/dashboard/ExternalLinksWidget';
import { InstrumentTradeDistribution } from '@/components/dashboard/InstrumentTradeDistribution';
import { DirectionSplit } from '@/components/dashboard/DirectionSplit';
import { DraggableChartWrapper } from '@/components/dashboard/DraggableChartWrapper';
import { motion } from 'framer-motion';

interface ChartDef {
  component: React.ComponentType;
  colSpan: number;
  rowSpan: number;
}

interface LayoutItem {
  id: string;
  row: number;
  col: number;
  colSpan: number;
  rowSpan: number;
}

const GRID_COLS = 3;

const CHART_CONFIGS: Record<string, ChartDef> = {
  recentTrades: { component: RecentTrades, colSpan: 1, rowSpan: 1 },
  dailyCumulativePnL: { component: DailyCumulativePnLChart, colSpan: 1, rowSpan: 1 },
  netDailyPnL: { component: NetDailyPnLChart, colSpan: 1, rowSpan: 1 },
  calendar: { component: MonthlyPerformanceCalendar, colSpan: 2, rowSpan: 2 },
  tradeTime: { component: TradeTimePerformanceChart, colSpan: 1, rowSpan: 1 },
  tradeDuration: { component: TradeDurationPerformanceChart, colSpan: 1, rowSpan: 1 },
  symbolAnalysis: { component: SymbolAnalysisChart, colSpan: 2, rowSpan: 1 },
  longShortAnalysis: { component: LongShortAnalysisChart, colSpan: 1, rowSpan: 1 },
  externalLinks: { component: ExternalLinksWidget, colSpan: 1, rowSpan: 1 },
  instrumentDistribution: { component: InstrumentTradeDistribution, colSpan: 2, rowSpan: 1 },
  directionSplit: { component: DirectionSplit, colSpan: 2, rowSpan: 1 },
  yearlyCalendar: { component: YearlyCalendarWidget, colSpan: 2, rowSpan: 1 },
  forexNewsKpi: { component: ForexNewsKpi, colSpan: 1, rowSpan: 1 },
};

const DEFAULT_CHART_ORDER = [
  'recentTrades',
  'dailyCumulativePnL',
  'netDailyPnL',
  'calendar',
  'tradeTime',
  'tradeDuration',
  'symbolAnalysis',
  'longShortAnalysis',
];

/** Greedy-pack an ordered list of chart ids into the 3-column grid */
function packLayout(ids: string[]): LayoutItem[] {
  const items: LayoutItem[] = [];
  const occupied = new Set<string>();
  const cellKey = (r: number, c: number) => `${r},${c}`;
  const fits = (r: number, c: number, cs: number, rs: number) => {
    if (c + cs > GRID_COLS) return false;
    for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) {
      if (occupied.has(cellKey(r + dr, c + dc))) return false;
    }
    return true;
  };
  const place = (id: string, cs: number, rs: number) => {
    for (let r = 0; r < 1000; r++) {
      for (let c = 0; c <= GRID_COLS - cs; c++) {
        if (fits(r, c, cs, rs)) {
          for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) {
            occupied.add(cellKey(r + dr, c + dc));
          }
          items.push({ id, row: r, col: c, colSpan: cs, rowSpan: rs });
          return;
        }
      }
    }
  };
  ids.forEach(id => {
    const cfg = CHART_CONFIGS[id];
    if (!cfg) return;
    place(id, Math.min(cfg.colSpan, GRID_COLS), cfg.rowSpan);
  });
  return items;
}

function isValidLayout(layout: unknown): layout is LayoutItem[] {
  return Array.isArray(layout) && layout.every(it =>
    it && typeof it === 'object' &&
    typeof (it as LayoutItem).id === 'string' && CHART_CONFIGS[(it as LayoutItem).id] &&
    typeof (it as LayoutItem).row === 'number' && typeof (it as LayoutItem).col === 'number' &&
    typeof (it as LayoutItem).colSpan === 'number' && typeof (it as LayoutItem).rowSpan === 'number'
  );
}

const Dashboard = () => {
  const { isEditMode } = useDashboardEdit();
  const { getPreferences, updatePreferences, user } = useAuth();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [pendingCell, setPendingCell] = useState<{ row: number; col: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const skipNextPersist = useRef(true);

  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    const prefs = getPreferences();
    if (isValidLayout(prefs.dashboardChartLayout)) return prefs.dashboardChartLayout;
    const order = (prefs.dashboardChartOrder && Array.isArray(prefs.dashboardChartOrder))
      ? prefs.dashboardChartOrder.filter(id => CHART_CONFIGS[id])
      : DEFAULT_CHART_ORDER;
    return packLayout(order);
  });

  useEffect(() => {
    const prefs = getPreferences();
    skipNextPersist.current = true;
    if (isValidLayout(prefs.dashboardChartLayout)) {
      setLayout(prefs.dashboardChartLayout);
    } else {
      const order = (prefs.dashboardChartOrder && Array.isArray(prefs.dashboardChartOrder))
        ? prefs.dashboardChartOrder.filter(id => CHART_CONFIGS[id])
        : DEFAULT_CHART_ORDER;
      setLayout(packLayout(order));
    }
  }, [user, getPreferences]);

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    updatePreferences({ dashboardChartLayout: layout });
  }, [layout, updatePreferences]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ---------- Derived: occupancy + total rows + empty cells ----------
  const { occupied, totalRows, emptyCells } = useMemo(() => {
    const occ = new Map<string, string>(); // "r,c" -> widget id
    let maxRow = 0;
    layout.forEach(it => {
      for (let dr = 0; dr < it.rowSpan; dr++) {
        for (let dc = 0; dc < it.colSpan; dc++) {
          occ.set(`${it.row + dr},${it.col + dc}`, it.id);
        }
      }
      maxRow = Math.max(maxRow, it.row + it.rowSpan);
    });
    const rows = isEditMode ? maxRow + 1 : maxRow; // trailing empty row in edit mode
    const empties: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!occ.has(`${r},${c}`)) empties.push({ row: r, col: c });
      }
    }
    return { occupied: occ, totalRows: rows, emptyCells: empties };
  }, [layout, isEditMode]);

  // ---------- Handlers ----------
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    document.body.style.cursor = 'grabbing';
  };
  const handleDragCancel = () => {
    setActiveId(null);
    document.body.style.cursor = '';
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    document.body.style.cursor = '';
    if (!over) return;
    const activeIdStr = active.id as string;
    const overId = over.id as string;
    if (activeIdStr === overId) return;

    setLayout(prev => {
      const dragged = prev.find(it => it.id === activeIdStr);
      if (!dragged) return prev;

      // Drop on empty cell
      if (overId.startsWith('cell:')) {
        const [r, c] = overId.slice(5).split(',').map(Number);
        // Clamp colSpan if it overflows
        const cs = Math.min(dragged.colSpan, GRID_COLS - c);
        // Check destination is fully clear (other widgets)
        const others = prev.filter(it => it.id !== activeIdStr);
        const otherOcc = new Set<string>();
        others.forEach(it => {
          for (let dr = 0; dr < it.rowSpan; dr++) for (let dc = 0; dc < it.colSpan; dc++) {
            otherOcc.add(`${it.row + dr},${it.col + dc}`);
          }
        });
        for (let dr = 0; dr < dragged.rowSpan; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (otherOcc.has(`${r + dr},${c + dc}`)) return prev; // conflict, ignore
          }
        }
        return prev.map(it => it.id === activeIdStr ? { ...it, row: r, col: c, colSpan: cs } : it);
      }

      // Drop on another widget → swap positions (preserve each one's span)
      const target = prev.find(it => it.id === overId);
      if (!target) return prev;
      return prev.map(it => {
        if (it.id === activeIdStr) return { ...it, row: target.row, col: target.col };
        if (it.id === overId) return { ...it, row: dragged.row, col: dragged.col };
        return it;
      });
    });
  };

  const handleAddChart = (chartId: string) => {
    const cfg = CHART_CONFIGS[chartId];
    if (!cfg || layout.some(it => it.id === chartId)) return;
    setLayout(prev => {
      const cell = pendingCell;
      setPendingCell(null);
      if (cell) {
        const cs = Math.min(cfg.colSpan, GRID_COLS - cell.col);
        const others = prev;
        const otherOcc = new Set<string>();
        others.forEach(it => {
          for (let dr = 0; dr < it.rowSpan; dr++) for (let dc = 0; dc < it.colSpan; dc++) {
            otherOcc.add(`${it.row + dr},${it.col + dc}`);
          }
        });
        let fits = true;
        for (let dr = 0; dr < cfg.rowSpan; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (otherOcc.has(`${cell.row + dr},${cell.col + dc}`)) { fits = false; break; }
          }
        }
        if (fits) {
          return [...prev, { id: chartId, row: cell.row, col: cell.col, colSpan: cs, rowSpan: cfg.rowSpan }];
        }
      }
      // Append: re-pack everything plus the new id
      return packLayout([...prev.map(i => i.id), chartId]);
    });
  };

  const handleRemoveChart = (chartId: string) => {
    setLayout(prev => prev.filter(it => it.id !== chartId));
  };

  const openLibraryAtCell = (row: number, col: number) => {
    setPendingCell({ row, col });
    setIsLibraryOpen(true);
  };

  const renderChart = (chartId: string) => {
    const cfg = CHART_CONFIGS[chartId];
    if (!cfg) return null;
    const C = cfg.component;
    return <C />;
  };

  const activeIds = useMemo(() => layout.map(it => it.id), [layout]);

  return (
    <div className="space-y-6 md:space-y-8">
      {isEditMode && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center"
        >
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
            Drag charts to reorder • Drop into any empty cell • Click + to add a widget
          </span>
        </motion.div>
      )}

      <DashboardMetrics isEditMode={isEditMode} />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={activeIds} strategy={rectSortingStrategy}>
          {/* lg+: true positioned 3-col grid. Below lg: simple flow. */}
          <div className="hidden lg:grid gap-3" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`, gridAutoRows: 'minmax(220px, auto)' }}>
            {layout.map(it => (
              <DraggableChartWrapper
                key={it.id}
                id={it.id}
                isEditMode={isEditMode}
                onRemove={handleRemoveChart}
                isActive={activeId === it.id}
                placement={{
                  gridColumn: `${it.col + 1} / span ${it.colSpan}`,
                  gridRow: `${it.row + 1} / span ${it.rowSpan}`,
                }}
              >
                {renderChart(it.id)}
              </DraggableChartWrapper>
            ))}
            {isEditMode && emptyCells.map(({ row, col }) => (
              <EmptyCellDroppable
                key={`cell:${row},${col}`}
                row={row}
                col={col}
                onClick={() => openLibraryAtCell(row, col)}
              />
            ))}
          </div>

          {/* md/mobile: flow layout, sorted by (row, col) */}
          <div className="grid lg:hidden grid-cols-1 md:grid-cols-2 gap-3">
            {[...layout]
              .sort((a, b) => (a.row - b.row) || (a.col - b.col))
              .map(it => (
                <DraggableChartWrapper
                  key={it.id}
                  id={it.id}
                  isEditMode={isEditMode}
                  onRemove={handleRemoveChart}
                  isActive={activeId === it.id}
                  placement={{ gridColumn: it.colSpan >= 2 ? 'span 2 / span 2' : undefined }}
                >
                  {renderChart(it.id)}
                </DraggableChartWrapper>
              ))}
            {isEditMode && (
              <button
                onClick={() => { setPendingCell(null); setIsLibraryOpen(true); }}
                className="min-h-[120px] rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/40 text-sm text-muted-foreground/70"
              >
                + Add widget
              </button>
            )}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
          {activeId ? (
            <div className="rounded-xl shadow-2xl ring-2 ring-primary/40 bg-background/95 backdrop-blur-sm overflow-hidden opacity-95 pointer-events-none" style={{ transform: 'scale(1.02)' }}>
              {renderChart(activeId)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ChartLibraryModal
        open={isLibraryOpen}
        onOpenChange={(o) => { setIsLibraryOpen(o); if (!o) setPendingCell(null); }}
        activeCharts={layout.map(it => it.id)}
        onAddChart={handleAddChart}
      />
    </div>
  );
};

const EmptyCellDroppable = ({ row, col, onClick }: { row: number; col: number; onClick: () => void }) => {
  const id = `cell:${row},${col}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ gridColumn: `${col + 1} / span 1`, gridRow: `${row + 1} / span 1` }}
      className={`transition-all ${isOver ? 'ring-2 ring-primary/60 rounded-xl scale-[1.01]' : ''}`}
    >
      <AddWidgetPlaceholder onClick={onClick} />
    </div>
  );
};

export default Dashboard;
