import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode, PRIVACY_MASK } from '@/hooks/usePrivacyMode';
import { calculateTradeMetrics, Trade } from '@/types/trade';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, parseISO, startOfDay } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DayDetailsModal } from '@/components/dayview/DayDetailsModal';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface DayData {
  netPnl: number;
  tradeCount: number;
}

const currentYearConst = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => currentYearConst - 10 + i);

function YearDropdown({ selectedYear, onChange }: { selectedYear: number; onChange: (y: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-lg font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded px-2 py-0.5 transition-colors border-b border-border"
      >
        {selectedYear}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-popover border border-border rounded-md shadow-md z-50 py-1 max-h-48 overflow-y-auto min-w-[80px]">
          {YEAR_OPTIONS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => { onChange(y); setOpen(false); }}
              className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors", y === selectedYear && "bg-accent font-medium")}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const YearlyCalendar = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { filteredTrades } = useFilteredTrades();
  const { formatCurrency } = useGlobalFilters();
  const { isPrivacyMode } = usePrivacyMode();
  
  // Day details modal state
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayTrades, setSelectedDayTrades] = useState<Trade[]>([]);

  // Group trades by date and calculate daily P&L
  const dailyData = useMemo(() => {
    const data: Record<string, DayData> = {};

    filteredTrades.forEach((trade) => {
      const metrics = calculateTradeMetrics(trade);
      // Use the first entry date as the trade date
      const tradeDate = metrics.openDate ? format(new Date(metrics.openDate), 'yyyy-MM-dd') : null;
      
      if (tradeDate) {
        if (!data[tradeDate]) {
          data[tradeDate] = { netPnl: 0, tradeCount: 0 };
        }
        data[tradeDate].netPnl += metrics.netPnl;
        data[tradeDate].tradeCount += 1;
      }
    });

    return data;
  }, [filteredTrades]);

  const handlePrevYear = () => setSelectedYear(prev => prev - 1);
  const handleNextYear = () => setSelectedYear(prev => prev + 1);

  // Generate calendar days for a month
  const getMonthDays = (year: number, monthIndex: number) => {
    const monthDate = new Date(year, monthIndex, 1);
    const start = startOfWeek(startOfMonth(monthDate));
    const end = endOfWeek(endOfMonth(monthDate));
    
    const days: Date[] = [];
    let current = start;
    
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    
    return days;
  };

  const getDayClass = (date: Date, monthIndex: number) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = dailyData[dateKey];
    const isCurrentMonth = date.getMonth() === monthIndex;
    
    if (!isCurrentMonth) {
      return 'text-muted-foreground/30';
    }
    
    if (dayData) {
      if (dayData.netPnl > 0) {
        return 'profit-text border border-profit/40';
      } else if (dayData.netPnl < 0) {
        return 'loss-text border border-loss/40';
      }
    }
    
    return 'text-muted-foreground';
  };

  // Handle day click to open modal
  const handleDayClick = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayTrades = filteredTrades.filter(trade => {
      const metrics = calculateTradeMetrics(trade);
      return metrics.openDate && format(new Date(metrics.openDate), 'yyyy-MM-dd') === dayKey;
    });
    setSelectedDayDate(day);
    setSelectedDayTrades(dayTrades);
  };

  const handleCloseModal = () => {
    setSelectedDayDate(null);
    setSelectedDayTrades([]);
  };

  return (
    <TooltipProvider>
      <div className="glass-card rounded-2xl p-4 sm:p-6 mx-auto max-w-6xl">
        {/* Year Header */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={handlePrevYear}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <YearDropdown selectedYear={selectedYear} onChange={setSelectedYear} />
          <button
            onClick={handleNextYear}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 12-Month Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {MONTHS.map((monthName, monthIndex) => {
            const monthDays = getMonthDays(selectedYear, monthIndex);
            
            return (
              <div key={monthName} className="space-y-1">
                {/* Month Name */}
                <h3 className="text-xs font-medium text-foreground text-center mb-2">
                  {monthName}
                </h3>
                
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-px mb-0.5">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="text-[9px] text-muted-foreground text-center py-0.5"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-px">
                  {monthDays.map((date, idx) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const dayData = dailyData[dateKey];
                    const isCurrentMonth = date.getMonth() === monthIndex;
                    const dayNumber = date.getDate();

                    return (
                      <Tooltip key={idx} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => isCurrentMonth && handleDayClick(date)}
                            style={dayData && isCurrentMonth ? { backgroundColor: dayData.netPnl > 0 ? 'hsl(var(--profit) / 0.15)' : dayData.netPnl < 0 ? 'hsl(var(--loss) / 0.15)' : undefined } : undefined}
                            className={cn(
                              "aspect-square flex items-center justify-center text-[9px] rounded-[2px] transition-colors",
                              getDayClass(date, monthIndex),
                              isToday(date) && isCurrentMonth && "ring-1 ring-primary",
                              isCurrentMonth ? "cursor-pointer hover:ring-1 hover:ring-primary/50" : "cursor-default"
                            )}
                          >
                            {isCurrentMonth ? dayNumber : ''}
                          </div>
                        </TooltipTrigger>
                        {isCurrentMonth && (
                          <TooltipContent 
                            side="top" 
                            className="bg-card border border-border px-3 py-2 shadow-xl"
                          >
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-foreground">
                                {format(date, 'MMMM d, yyyy')}
                              </div>
                              {dayData ? (
                                <>
                                  <div className={cn(
                                    "text-sm font-semibold",
                                    dayData.netPnl > 0 ? "text-profit" : dayData.netPnl < 0 ? "text-loss" : "text-muted-foreground"
                                  )}>
                                    Net P&L: {isPrivacyMode ? PRIVACY_MASK : formatCurrency(dayData.netPnl)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {dayData.tradeCount} trade{dayData.tradeCount !== 1 ? 's' : ''}
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-muted-foreground">No trades</div>
                              )}
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Bottom spacing */}
        <div className="h-4" />
      </div>

      {/* Day Details Modal */}
      {selectedDayDate && (
        <DayDetailsModal
          isOpen={!!selectedDayDate}
          onClose={handleCloseModal}
          date={selectedDayDate}
          trades={selectedDayTrades}
        />
      )}
    </TooltipProvider>
  );
};

export default YearlyCalendar;
