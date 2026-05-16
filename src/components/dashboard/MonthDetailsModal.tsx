import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { FileText, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Trade, calculateTradeMetrics } from '@/types/trade';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { useDiaryContext } from '@/contexts/DiaryContext';
import { useTradeModal } from '@/contexts/TradeModalContext';
import { IntradayPnLChart } from '@/components/dayview/IntradayPnLChart';
import { DayTradesTable } from '@/components/dayview/DayTradesTable';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { isoToDateTimeLocalInputValue } from '@/lib/datetime';

interface MonthDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  trades: Trade[];
}

export const MonthDetailsModal = ({ isOpen, onClose, date, trades }: MonthDetailsModalProps) => {
  const navigate = useNavigate();
  const { formatCurrency, setDateRange, setDatePreset } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency } = usePrivacyMode();
  const { createNote, setSelectedFolderId, setSelectedNoteId } = useDiaryContext();
  const { openModalWithDate } = useTradeModal();

  const stats = useMemo(() => {
    return trades.reduce(
      (acc, trade) => {
        const metrics = calculateTradeMetrics(trade);
        acc.netPnl += metrics.netPnl;
        acc.grossPnl += metrics.grossPnl;
        acc.totalTrades += 1;
        acc.totalQuantity += metrics.totalQuantity;
        acc.totalCommissions += metrics.totalCharges;
        acc.totalDurationMinutes += metrics.durationMinutes;
        if (metrics.netPnl > 0) {
          acc.winners += 1;
          acc.totalWins += metrics.netPnl;
        } else if (metrics.netPnl < 0) {
          acc.losers += 1;
          acc.totalLosses += Math.abs(metrics.netPnl);
        } else {
          acc.breakeven += 1;
        }
        return acc;
      },
      {
        netPnl: 0,
        grossPnl: 0,
        totalTrades: 0,
        winners: 0,
        losers: 0,
        breakeven: 0,
        totalQuantity: 0,
        totalCommissions: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDurationMinutes: 0,
      }
    );
  }, [trades]);

  const winsAndLosses = stats.winners + stats.losers;
  const winRate = winsAndLosses > 0 ? (stats.winners / winsAndLosses) * 100 : 0;
  const avgDurationMinutes = stats.totalTrades > 0 ? stats.totalDurationMinutes / stats.totalTrades : 0;

  const formatDuration = (minutes: number) => {
    if (minutes < 1) return '< 1m';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  };

  const isProfit = stats.netPnl >= 0;
  const formattedMonth = format(date, 'MMMM yyyy');

  const handleAddTrade = () => {
    const now = new Date();
    const entryDate = startOfMonth(date);
    entryDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
    const entryDateStr = isoToDateTimeLocalInputValue(entryDate.toISOString());
    onClose();
    openModalWithDate(entryDateStr);
  };

  const handleAddNote = () => {
    const monthTitle = format(date, 'MMM yyyy');
    const monthDateStr = format(startOfMonth(date), 'yyyy-MM-dd');
    const newNote = createNote({
      title: `Month Note: ${monthTitle}`,
      linkedDate: monthDateStr,
    });
    setSelectedFolderId('day-notes');
    if (newNote) setSelectedNoteId(newNote.id);
    onClose();
    navigate('/diary');
  };

  const handleViewDetails = () => {
    setDatePreset('custom');
    setDateRange({
      from: startOfMonth(date),
      to: endOfMonth(date),
    });
    onClose();
  };

  const profitFactor = stats.totalLosses > 0
    ? stats.totalWins / stats.totalLosses
    : stats.totalWins > 0 ? Infinity : 0;
  const profitFactorDisplay = profitFactor === Infinity ? '∞' : profitFactor === 0 ? '–' : profitFactor.toFixed(2);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] sm:w-auto p-0 sm:p-6 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-0 pb-3 sm:pb-4 border-b sm:border-b-0 border-border flex-shrink-0">
          <DialogHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <DialogTitle className="text-base sm:text-lg font-semibold">{formattedMonth}</DialogTitle>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-muted-foreground">•</span>
                  <span className={cn('text-sm sm:text-base font-semibold', isPrivacyMode ? 'text-foreground' : isProfit ? 'text-profit' : 'text-loss')}>
                    Net P&L {maskCurrency(stats.netPnl, formatCurrency)}
                  </span>
                </div>
              </div>
              <div className="flex sm:hidden items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleAddTrade}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button variant="default" size="icon" className="h-8 w-8" onClick={handleAddNote}>
                  <FileText className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAddTrade}>
                <Plus className="w-3.5 h-3.5" />
                Add Trade
              </Button>
              <Button variant="default" size="sm" className="gap-1.5" onClick={handleAddNote}>
                <FileText className="w-3.5 h-3.5" />
                Add note
              </Button>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-0">
          <div className="space-y-4 sm:space-y-5 pb-4 sm:pb-0">
            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 sm:h-40 border border-dashed border-border rounded-xl gap-3">
                <p className="text-muted-foreground text-sm">No trades this month</p>
                <Button variant="default" size="sm" className="gap-2" onClick={handleAddTrade}>
                  <Plus className="w-4 h-4" />
                  Add Trade
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  <div className="w-full md:w-[300px] h-[140px] md:h-[140px] flex-shrink-0">
                    <IntradayPnLChart trades={trades} />
                  </div>
                  <div className="flex-1 grid grid-cols-3 sm:grid-cols-4 gap-x-3 sm:gap-x-6 gap-y-3 sm:gap-y-4">
                    <div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5">Total Trades</p>
                      <p className="text-sm sm:text-lg font-semibold text-foreground">{stats.totalTrades}</p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5">Gross P&L</p>
                      <p className={cn('text-sm sm:text-lg font-semibold', isPrivacyMode ? 'text-foreground' : isProfit ? 'text-profit' : 'text-loss')}>
                        {maskCurrency(stats.grossPnl, formatCurrency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5">Winners / Losers</p>
                      <p className="text-sm sm:text-lg font-semibold text-foreground">{stats.winners} / {stats.losers}</p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5">Commissions</p>
                      <p className="text-sm sm:text-lg font-semibold text-foreground">
                        {maskCurrency(stats.totalCommissions, (v) => formatCurrency(v, false))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5">Win Rate</p>
                      <p className="text-sm sm:text-lg font-semibold text-foreground">{winRate.toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5">Volume</p>
                      <p className="text-sm sm:text-lg font-semibold text-foreground">{stats.totalQuantity.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5">Profit Factor</p>
                      <p className="text-sm sm:text-lg font-semibold text-foreground">{profitFactorDisplay}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5">Avg Duration</p>
                      <p className="text-sm sm:text-lg font-semibold text-foreground">{formatDuration(avgDurationMinutes)}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 sm:pt-4 border-t border-border">
                  <div className="overflow-auto max-h-[35vh] sm:max-h-none" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                    <DayTradesTable trades={trades} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 sm:gap-3 p-4 sm:p-0 sm:pt-4 border-t border-border flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleViewDetails}>
            View Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};