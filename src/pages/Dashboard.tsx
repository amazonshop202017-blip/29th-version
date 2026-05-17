import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DndContext,
  closestCenter,
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
  arrayMove,
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
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { motion } from 'framer-motion';

interface ChartConfig {
  id: string;
  component: React.ComponentType;
  colSpan: number;
  rowSpan: number;
}

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

const CHART_CONFIGS: Record<string, Omit<ChartConfig, 'id'>> = {
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

const Dashboard = () => {
  const { stats } = useFilteredTrades();
  const { formatCurrency } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency } = usePrivacyMode();
  const { isEditMode } = useDashboardEdit();
  const { getPreferences, updatePreferences, user } = useAuth();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chartOrder, setChartOrder] = useState<string[]>(() => {
    const prefs = getPreferences();
    if (prefs.dashboardChartOrder && Array.isArray(prefs.dashboardChartOrder) && prefs.dashboardChartOrder.every(id => CHART_CONFIGS[id])) {
      return prefs.dashboardChartOrder;
    }
    return DEFAULT_CHART_ORDER;
  });

  // Reload when user changes
  useEffect(() => {
    const prefs = getPreferences();
    if (prefs.dashboardChartOrder && Array.isArray(prefs.dashboardChartOrder) && prefs.dashboardChartOrder.every(id => CHART_CONFIGS[id])) {
      setChartOrder(prefs.dashboardChartOrder);
    } else {
      setChartOrder(DEFAULT_CHART_ORDER);
    }
  }, [user, getPreferences]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    updatePreferences({ dashboardChartOrder: chartOrder });
  }, [chartOrder, updatePreferences]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    document.body.style.cursor = 'grabbing';
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    document.body.style.cursor = '';

    if (!over || active.id === over.id) return;
    const overId = over.id as string;
    const activeIdStr = active.id as string;

    setChartOrder((items) => {
      const oldIndex = items.indexOf(activeIdStr);
      if (oldIndex < 0) return items;
      if (overId.startsWith('__gap_')) {
        // append to end
        const next = [...items];
        next.splice(oldIndex, 1);
        next.push(activeIdStr);
        return next;
      }
      const newIndex = items.indexOf(overId);
      if (newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleDragCancel = () => {
    setActiveId(null);
    document.body.style.cursor = '';
  };

  const handleAddChart = (chartId: string) => {
    if (!chartOrder.includes(chartId)) {
      setChartOrder([...chartOrder, chartId]);
    }
  };

  const handleRemoveChart = (chartId: string) => {
    setChartOrder((items) => items.filter((id) => id !== chartId));
  };

  const renderChart = (chartId: string) => {
    const config = CHART_CONFIGS[chartId];
    if (!config) return null;
    const ChartComponent = config.component;
    return <ChartComponent />;
  };

  // Compute trailing gap count at lg (3 col) breakpoint
  const totalCols = chartOrder.reduce((acc, id) => acc + (CHART_CONFIGS[id]?.colSpan || 1), 0);
  const lgGapCount = (3 - (totalCols % 3)) % 3;
  // ensure at least 2 add placeholders visible in edit mode for the user to drop/click
  const placeholderCount = isEditMode ? Math.max(lgGapCount, 2) : 0;

  return (
    <div className="space-y-6 md:space-y-8">
      {isEditMode && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center"
        >
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
            Drag charts to reorder
          </span>
        </motion.div>
      )}

      {/* Top metrics - draggable in edit mode */}
      <DashboardMetrics isEditMode={isEditMode} />

      {/* Draggable charts section */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={chartOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-2">
            {chartOrder.map((chartId) => {
              const config = CHART_CONFIGS[chartId];
              if (!config) return null;
              return (
                <DraggableChartWrapper
                  key={chartId}
                  id={chartId}
                  isEditMode={isEditMode}
                  colSpan={config.colSpan}
                  rowSpan={config.rowSpan}
                  onRemove={handleRemoveChart}
                  isActive={activeId === chartId}
                >
                  {renderChart(chartId)}
                </DraggableChartWrapper>
              );
            })}
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <GapDroppable key={`__gap_${i}__`} id={`__gap_${i}__`}>
                <AddWidgetPlaceholder onClick={() => setIsLibraryOpen(true)} />
              </GapDroppable>
            ))}
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
        onOpenChange={setIsLibraryOpen}
        activeCharts={chartOrder}
        onAddChart={handleAddChart}
      />
    </div>
  );
};

const GapDroppable = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`col-span-1 transition-all ${isOver ? 'ring-2 ring-primary/60 rounded-xl' : ''}`}>
      {children}
    </div>
  );
};

export default Dashboard;
