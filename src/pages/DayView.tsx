import { useState, useMemo } from 'react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useTradesContext } from '@/contexts/TradesContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { DayCard } from '@/components/dayview/DayCard';
import { DaySidebarCalendar } from '@/components/dayview/DaySidebarCalendar';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface DayGroup {
  date: Date;
  dateKey: string;
  trades: Trade[];
}

const DayView = () => {
  const { filteredTrades } = useFilteredTrades();
  const { trades: allTrades } = useTradesContext();
  const { selectedAccounts, setDateRange, setDatePreset } = useGlobalFilters();
  const { getActiveAccountIds } = useAccountsContext();
  
  // Calendar month state
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  // Get active account names for filtering
  const activeAccountIds = useMemo(() => getActiveAccountIds(), [getActiveAccountIds]);

  // Filter trades by account (but NOT by date) for the calendar
  const accountFilteredTrades = useMemo(() => {
    const activeSet = new Set(activeAccountIds);
    if (selectedAccounts.length === 0) {
      return allTrades.filter(trade => activeSet.has(trade.accountId));
    }
    // Intersect explicit selection with active accounts so archived ones are never included
    const selectedSet = new Set(selectedAccounts);
    return allTrades.filter(trade => selectedSet.has(trade.accountId) && activeSet.has(trade.accountId));
  }, [allTrades, selectedAccounts, activeAccountIds]);

  // Group filtered trades by date
  const dayGroups = useMemo(() => {
    const groups: Record<string, DayGroup> = {};
    
    filteredTrades.forEach(trade => {
      const metrics = calculateTradeMetrics(trade);
      if (metrics.openDate) {
        const tradeDate = parseISO(metrics.openDate);
        const dateKey = format(tradeDate, 'yyyy-MM-dd');
        
        if (!groups[dateKey]) {
          groups[dateKey] = {
            date: startOfDay(tradeDate),
            dateKey,
            trades: [],
          };
        }
        groups[dateKey].trades.push(trade);
      }
    });
    
    // Sort by date descending (most recent first)
    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredTrades]);

  // Handle date selection from calendar
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setDatePreset('custom');
    setDateRange({
      from: startOfDay(date),
      to: endOfDay(date),
    });
  };

  return (
    <div className="space-y-6">
      {/* Day/Week toggle */}
      <div className="flex items-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/40">
          {(['day', 'week'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
                viewMode === mode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Calendar (above cards) */}
      <div className="block lg:hidden">
        <DaySidebarCalendar
          trades={accountFilteredTrades}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Day Cards List */}
        <div className="flex-1 space-y-4 min-w-0">
          {viewMode === 'week' ? (
            <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">Week view coming soon</p>
            </div>
          ) : dayGroups.length === 0 ? (
            <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground">No trades found for the selected filters</p>
            </div>
          ) : (
            dayGroups.map(group => (
              <DayCard
                key={group.dateKey}
                date={group.date}
                trades={group.trades}
              />
            ))
          )}
        </div>

        {/* Sticky Calendar Sidebar - Desktop only */}
        <div className="w-[280px] flex-shrink-0 hidden lg:block">
          <DaySidebarCalendar
            trades={accountFilteredTrades}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </div>
      </div>
    </div>
  );
};

export default DayView;
