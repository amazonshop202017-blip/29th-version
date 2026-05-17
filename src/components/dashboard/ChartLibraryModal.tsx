import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Plus } from 'lucide-react';

const WIDGET_LIST = [
  { id: 'recentTrades', name: 'Recent Trades', description: 'Latest trade entries with P&L' },
  { id: 'dailyCumulativePnL', name: 'Cumulative P&L', description: 'Daily cumulative profit/loss chart' },
  { id: 'netDailyPnL', name: 'Net Daily P&L', description: 'Net P&L per trading day' },
  { id: 'calendar', name: 'Monthly Calendar', description: 'Calendar heatmap of daily performance' },
  { id: 'tradeTime', name: 'Trade Time Performance', description: 'Performance by time of day' },
  { id: 'tradeDuration', name: 'Trade Duration', description: 'Performance by holding duration' },
  { id: 'symbolAnalysis', name: 'Symbol Analysis', description: 'Breakdown by traded instruments' },
  { id: 'longShortAnalysis', name: 'Long/Short Analysis', description: 'Long vs short trade comparison' },
  { id: 'externalLinks', name: 'External Links', description: 'Quick access to your favorite external links' },
  { id: 'instrumentDistribution', name: 'Instrument Trade Distribution', description: 'Donut chart showing trade distribution across symbols' },
  { id: 'directionSplit', name: 'Direction Split', description: 'Long vs Short breakdown with profit factor, R, expectancy and best/worst' },
  { id: 'yearlyCalendar', name: 'Yearly Calendar', description: '12-month overview with P&L, trades and R per month' },
  { id: 'forexNewsKpi', name: 'Forex News', description: 'Upcoming economic events filtered by currency & impact' },
];

interface ChartLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCharts: string[];
  onAddChart: (chartId: string) => void;
}

export const ChartLibraryModal = ({ open, onOpenChange, activeCharts, onAddChart }: ChartLibraryModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Widget Library</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {WIDGET_LIST.map((widget) => {
            const isActive = activeCharts.includes(widget.id);
            return (
              <div
                key={widget.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{widget.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{widget.description}</p>
                </div>
                <Button
                  size="sm"
                  variant={isActive ? "secondary" : "outline"}
                  className="ml-3 shrink-0 text-xs h-8"
                  disabled={isActive}
                  onClick={() => {
                    onAddChart(widget.id);
                  }}
                >
                  {isActive ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Insert
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
