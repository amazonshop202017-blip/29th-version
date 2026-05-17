import { useState, useEffect, useMemo, ReactNode } from 'react';
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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { WinRateGauge } from '@/components/dashboard/WinRateGauge';
import { ProfitFactorRing } from '@/components/dashboard/ProfitFactorRing';
import { AvgWinLossRatio } from '@/components/dashboard/AvgWinLossRatio';
import { CurrentStreakMetric } from '@/components/dashboard/CurrentStreakMetric';
import { TradeExpectancyMetric } from '@/components/dashboard/TradeExpectancyMetric';
import { AccountBalancePnLMetric } from '@/components/dashboard/AccountBalancePnLMetric';
import { AddWidgetPlaceholder } from '@/components/dashboard/AddWidgetPlaceholder';
import { MetricsLibraryModal } from '@/components/dashboard/MetricsLibraryModal';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { useAuth } from '@/contexts/AuthContext';
import { calculateTradeMetrics } from '@/types/trade';
import { parseISO, format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

const DEFAULT_METRICS_ORDER = ['netPnl', 'tradeWinRate', 'profitFactor', 'dayWinRate', 'avgWinLoss'];
const MAX_METRICS = 5;

interface SortableMetricProps {
  id: string;
  isEditMode: boolean;
  onRemove: (id: string) => void;
  children: ReactNode;
  className?: string;
  isActive?: boolean;
}

const SortableMetric = ({ id, isEditMode, onRemove, children, className, isActive }: SortableMetricProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    animateLayoutChanges: () => true,
    transition: { duration: 220, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${(isDragging || isActive) ? 'opacity-30' : ''} ${isEditMode ? 'ring-2 ring-primary/20 ring-dashed rounded-xl' : ''} ${className || ''}`}
    >
      {isEditMode && (
        <>
          <div
            {...attributes}
            {...listeners}
            className="absolute -top-2 -left-2 z-10 p-1 bg-primary text-primary-foreground rounded-md cursor-grab active:cursor-grabbing touch-none shadow-lg hover:bg-primary/90 transition-colors"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          <button
            onClick={() => onRemove(id)}
            className="absolute -top-2 -right-2 z-10 p-1 bg-destructive text-destructive-foreground rounded-md shadow-lg hover:bg-destructive/90 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {children}
    </div>
  );
};

interface DashboardMetricsProps {
  isEditMode: boolean;
}

export const DashboardMetrics = ({ isEditMode }: DashboardMetricsProps) => {
  const { stats, filteredTrades } = useFilteredTrades();
  const { formatCurrency } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency } = usePrivacyMode();
  const { getPreferences, updatePreferences, user } = useAuth();
  const [isMetricsLibraryOpen, setIsMetricsLibraryOpen] = useState(false);

  const microChartData = useMemo(() => {
    if (filteredTrades.length === 0) return [];
    const dailyPnL = new Map<string, number>();
    filteredTrades.forEach(t => {
      const m = calculateTradeMetrics(t);
      if (m.openDate) {
        const d = format(parseISO(m.openDate), 'yyyy-MM-dd');
        dailyPnL.set(d, (dailyPnL.get(d) || 0) + m.netPnl);
      }
    });
    let cum = 0;
    return Array.from(dailyPnL.keys()).sort().map(d => {
      cum += dailyPnL.get(d) || 0;
      return { v: cum };
    });
  }, [filteredTrades]);

  const [metricsOrder, setMetricsOrder] = useState<string[]>(() => {
    const prefs = getPreferences();
    if (prefs.dashboardMetricsOrder && Array.isArray(prefs.dashboardMetricsOrder) && prefs.dashboardMetricsOrder.length <= MAX_METRICS) {
      return prefs.dashboardMetricsOrder;
    }
    return DEFAULT_METRICS_ORDER;
  });

  // Reload when user changes
  useEffect(() => {
    const prefs = getPreferences();
    if (prefs.dashboardMetricsOrder && Array.isArray(prefs.dashboardMetricsOrder) && prefs.dashboardMetricsOrder.length <= MAX_METRICS) {
      setMetricsOrder(prefs.dashboardMetricsOrder);
    } else {
      setMetricsOrder(DEFAULT_METRICS_ORDER);
    }
  }, [user, getPreferences]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    updatePreferences({ dashboardMetricsOrder: metricsOrder });
  }, [metricsOrder, updatePreferences]);

  const [activeMetricId, setActiveMetricId] = useState<string | null>(null);

  const handleMetricDragStart = (event: DragStartEvent) => {
    setActiveMetricId(event.active.id as string);
    document.body.style.cursor = 'grabbing';
  };

  const handleMetricDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveMetricId(null);
    document.body.style.cursor = '';
    if (over && active.id !== over.id) {
      setMetricsOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMetricDragCancel = () => {
    setActiveMetricId(null);
    document.body.style.cursor = '';
  };

  const handleAddMetric = (metricId: string) => {
    if (!metricsOrder.includes(metricId) && metricsOrder.length < MAX_METRICS) {
      setMetricsOrder([...metricsOrder, metricId]);
    }
  };

  const handleRemoveMetric = (metricId: string) => {
    setMetricsOrder((items) => items.filter((id) => id !== metricId));
  };

  const renderMetric = (metricId: string, index: number) => {
    const delay = index * 0.1;
    switch (metricId) {
      case 'netPnl':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="glass-card rounded-xl px-3 py-2.5 h-full">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs text-muted-foreground">Net P&L</span>
              <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{stats.totalTrades}</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${isPrivacyMode ? 'text-foreground' : stats.netPnl >= 0 ? 'profit-text' : 'loss-text'}`}>
              {maskCurrency(stats.netPnl, formatCurrency)}
            </p>
            {microChartData.length > 1 && (
              <div className="h-8 mt-1 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={microChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="microPnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stats.netPnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={stats.netPnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={stats.netPnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
                      strokeWidth={1.5}
                      fill="url(#microPnlGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        );
      case 'tradeWinRate':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="glass-card rounded-xl px-3 py-2.5 h-full">
            <WinRateGauge value={stats.tradeWinRate} label="Trade Win %" winners={stats.winningTrades} losers={stats.losingTrades} breakeven={stats.breakevenTrades} />
          </motion.div>
        );
      case 'profitFactor':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="glass-card rounded-xl px-3 py-2.5 h-full">
            <ProfitFactorRing profitFactor={stats.profitFactor} totalProfits={stats.totalProfits} totalLosses={stats.totalLosses} />
          </motion.div>
        );
      case 'dayWinRate':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="glass-card rounded-xl px-3 py-2.5 h-full">
            <WinRateGauge value={stats.dayWinRate} label="Day Win %" winners={stats.winningDays} losers={stats.losingDays} breakeven={stats.breakevenDays} />
          </motion.div>
        );
      case 'avgWinLoss':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="glass-card rounded-xl px-3 py-2.5 h-full">
            <AvgWinLossRatio avgWin={stats.avgWin} avgLoss={stats.avgLoss} />
          </motion.div>
        );
      case 'currentStreak':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="glass-card rounded-xl px-3 py-2.5 h-full">
            <CurrentStreakMetric />
          </motion.div>
        );
      case 'tradeExpectancy':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="glass-card rounded-xl px-3 py-2.5 h-full">
            <TradeExpectancyMetric />
          </motion.div>
        );
      case 'accountBalancePnl':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="glass-card rounded-xl px-3 py-2.5 h-full">
            <AccountBalancePnLMetric />
          </motion.div>
        );
      default:
        return null;
    }
  };

  // Dynamic grid logic:
  // Mobile (<md): always 1 col
  // md: fits up to 3 in one row. If more, use 2-col grid (last spans full if odd)
  // lg: fits up to 5 in one row. If more, use 2-col grid (last spans full if odd)
  const count = metricsOrder.length + (isEditMode && metricsOrder.length < MAX_METRICS ? 1 : 0);
  // Mobile: fits up to 2 in one row. md: up to 3. lg: up to 5.
  const mobileClass = count <= 2 ? ({ 1: 'grid-cols-1', 2: 'grid-cols-2' }[count] || 'grid-cols-1') : 'grid-cols-2';
  const mdColsMap: Record<number, string> = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' };
  const lgColsMap: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' };
  const mdClass = count <= 3 ? (mdColsMap[count] || 'md:grid-cols-1') : 'md:grid-cols-2';
  const lgClass = count <= 5 ? (lgColsMap[count] || 'lg:grid-cols-1') : 'lg:grid-cols-2';
  const gridColsClass = `${mobileClass} ${mdClass} ${lgClass}`;

  // Last item spans full width if odd count exceeds single-row capacity at that breakpoint
  const needsMobileSpan = count > 2 && count % 2 !== 0;
  const needsMdSpan = count > 3 && count % 2 !== 0;
  const resetMdSpan = count <= 3 && needsMobileSpan; // at md all fit, reset mobile col-span
  const resetLgSpan = count <= 5; // at lg all fit, reset
  const needsLgSpan = count > 5 && count % 2 !== 0;

  const allItems = [
    ...metricsOrder.map((metricId, index) => ({ type: 'metric' as const, metricId, index })),
    ...(isEditMode && metricsOrder.length < MAX_METRICS ? [{ type: 'add' as const, metricId: '__add__', index: metricsOrder.length }] : []),
  ];

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleMetricDragStart}
        onDragEnd={handleMetricDragEnd}
        onDragCancel={handleMetricDragCancel}
      >
        <SortableContext items={metricsOrder} strategy={rectSortingStrategy}>
          <div className={`grid ${gridColsClass} gap-3 auto-rows-fr`}>
            {allItems.map((item, i) => {
              const isLast = i === allItems.length - 1;
              const spanClass = isLast ? [
                needsMobileSpan ? 'col-span-2' : '',
                resetMdSpan ? 'md:col-span-1' : '',
                needsMdSpan ? 'md:col-span-2' : '',
                (resetLgSpan && (needsMobileSpan || needsMdSpan)) ? 'lg:col-span-1' : '',
                needsLgSpan ? 'lg:col-span-2' : '',
              ].filter(Boolean).join(' ') : '';
              if (item.type === 'add') {
                return <div key="__add__" className={spanClass}><AddWidgetPlaceholder onClick={() => setIsMetricsLibraryOpen(true)} size="sm" /></div>;
              }
              return (
                <SortableMetric key={item.metricId} id={item.metricId} isEditMode={isEditMode} onRemove={handleRemoveMetric} className={spanClass} isActive={activeMetricId === item.metricId}>
                  {renderMetric(item.metricId, item.index)}
                </SortableMetric>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
          {activeMetricId ? (
            <div className="rounded-xl shadow-2xl ring-2 ring-primary/40 bg-background/95 backdrop-blur-sm overflow-hidden opacity-95 pointer-events-none" style={{ transform: 'scale(1.02)' }}>
              {renderMetric(activeMetricId, metricsOrder.indexOf(activeMetricId))}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <MetricsLibraryModal
        open={isMetricsLibraryOpen}
        onOpenChange={setIsMetricsLibraryOpen}
        activeMetrics={metricsOrder}
        onAddMetric={handleAddMetric}
      />
    </>
  );
};
