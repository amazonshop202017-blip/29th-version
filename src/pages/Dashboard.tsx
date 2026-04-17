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
};

const Dashboard = () => {
  const { stats } = useFilteredTrades();
  const { formatCurrency } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency } = usePrivacyMode();
  const { isEditMode } = useDashboardEdit();
  const { getPreferences, updatePreferences, user } = useAuth();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setChartOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
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
        onDragEnd={handleDragEnd}
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
                >
                  {renderChart(chartId)}
                </DraggableChartWrapper>
              );
            })}
            {isEditMode && (
              <>
                <AddWidgetPlaceholder onClick={() => setIsLibraryOpen(true)} />
                <AddWidgetPlaceholder onClick={() => setIsLibraryOpen(true)} />
              </>
            )}
          </div>
        </SortableContext>
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

export default Dashboard;
