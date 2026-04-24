import { useState, useMemo, useEffect } from 'react';
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
  Image as ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
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
import { AccountImportModal } from '@/components/settings/AccountImportModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface TableWithStickyHorizontalScrollProps {
  paginatedTrades: Trade[];
  allSelected: boolean;
  handleSelectAll: () => void;
  isColumnVisible: (key: string) => boolean;
  selectedTrades: Set<string>;
  setSelectedTrades: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleRowClick: (tradeId: string) => void;
  isPrivacyMode: boolean;
  maskCurrency: (value: number, formatter: (v: number) => string) => string;
  formatCurrency: (v: number) => string;
  accounts: { id: string; name: string }[];
  emptyState?: { title: string; subtitle: string };
}

const TableWithStickyHorizontalScroll = ({
  paginatedTrades,
  allSelected,
  handleSelectAll,
  isColumnVisible,
  selectedTrades,
  setSelectedTrades,
  handleRowClick,
  isPrivacyMode,
  maskCurrency,
  formatCurrency,
  accounts,
  emptyState,
}: TableWithStickyHorizontalScrollProps) => {
  const { classifyTradeOutcome } = useGlobalFilters();
  if (paginatedTrades.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{emptyState?.title ?? 'No trades recorded yet'}</p>
          <p className="text-sm mt-1">
            {emptyState?.subtitle ?? 'Click "Enter Trade" or the + button to add your first trade'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div
        className="flex-1 min-h-0 overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
      >
        <Table wrapperClassName="min-w-full overflow-visible">
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-8 px-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all trades on this page"
                />
              </TableHead>
              <TableHead className="w-[90px] px-1"></TableHead>
              {isColumnVisible('symbol') && <TableHead className="px-2">Symbol</TableHead>}
              {isColumnVisible('side') && <TableHead className="px-2">Side</TableHead>}
              {isColumnVisible('volume') && <TableHead className="px-2">Volume</TableHead>}
              {isColumnVisible('ticksPips') && <TableHead className="px-2">Ticks/Pips</TableHead>}
              {isColumnVisible('accountName') && <TableHead className="px-2">Account</TableHead>}
              {isColumnVisible('openDateTime') && <TableHead className="px-2">Open Date / Time</TableHead>}
              {isColumnVisible('closeDateTime') && <TableHead className="px-2">Close Date / Time</TableHead>}
              {isColumnVisible('duration') && <TableHead className="px-2">Duration</TableHead>}
              {isColumnVisible('avgEntry') && <TableHead className="px-2">Avg Entry</TableHead>}
              {isColumnVisible('avgExit') && <TableHead className="px-2">Avg Exit</TableHead>}
              {isColumnVisible('initialRisk') && <TableHead className="px-2">Stop Loss</TableHead>}
              {isColumnVisible('initialTarget') && <TableHead className="px-2">Take Profit</TableHead>}
              {isColumnVisible('grossPnl') && <TableHead className="px-2">Gross P&L</TableHead>}
              {isColumnVisible('netPnl') && <TableHead className="px-2">Net P&L</TableHead>}
              {isColumnVisible('realizedRMultiple') && <TableHead className="px-2">R Multiple</TableHead>}
              {isColumnVisible('plannedRRR') && <TableHead className="px-2">Planned RR</TableHead>}
              {isColumnVisible('farthestProfitTicks') && <TableHead className="px-2 text-right">MFE (pre-exit, ticks)</TableHead>}
              {isColumnVisible('farthestProfitPrice') && <TableHead className="px-2 text-right">MFE (pre-exit, price)</TableHead>}
              {isColumnVisible('farthestLossTicks') && <TableHead className="px-2 text-right">MAE (pre-exit, ticks)</TableHead>}
              {isColumnVisible('farthestLossPrice') && <TableHead className="px-2 text-right">MAE (pre-exit, price)</TableHead>}
              {isColumnVisible('postMaxTickPip') && <TableHead className="px-2 text-right">Highest Price (Ticks)</TableHead>}
              {isColumnVisible('postMaxPrice') && <TableHead className="px-2 text-right">Highest Price (Price)</TableHead>}
              {isColumnVisible('postMinTickPip') && <TableHead className="px-2 text-right">Lowest Price (Ticks)</TableHead>}
              {isColumnVisible('postMinPrice') && <TableHead className="px-2 text-right">Lowest Price (Price)</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTrades.map((trade) => {
              const metrics = calculateTradeMetrics(trade);
              const isSelected = selectedTrades.has(trade.id);
              const outcome = classifyTradeOutcome(
                metrics.netPnl,
                trade.savedReturnPercent ?? metrics.returnPercent,
                trade.breakEven
              );
              const isProfit = outcome === 'win';
              const isLoss = outcome === 'loss';

              return (
                <TableRow
                  key={trade.id}
                  onClick={() => handleRowClick(trade.id)}
                  className={cn(
                    'border-border cursor-pointer h-10',
                    isSelected
                      ? 'bg-secondary/50'
                      : isProfit
                        ? 'bg-profit/[0.07] hover:bg-profit/[0.12]'
                        : isLoss
                          ? 'bg-loss/[0.07] hover:bg-loss/[0.12]'
                          : 'bg-[#fcf9ff] dark:bg-[hsl(270,10%,14%)] hover:bg-[#f5f0fc] dark:hover:bg-[hsl(270,10%,17%)]'
                  )}
                >
                  <TableCell className="w-8 px-2 py-1" onClick={(e) => e.stopPropagation()}>
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
                  </TableCell>

                  <TableCell className="w-[90px] px-1 py-1" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-yellow-500">
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>

                  {isColumnVisible('symbol') && (
                    <TableCell className="font-semibold px-2 py-1">{trade.symbol}</TableCell>
                  )}

                  {isColumnVisible('side') && (
                    <TableCell className="px-2 py-1">
                      <div className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
                        trade.side === 'LONG' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                      )}>
                        {trade.side === 'LONG' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {trade.side}
                      </div>
                    </TableCell>
                  )}

                  {isColumnVisible('volume') && (
                    <TableCell className="font-mono px-2 py-1">{metrics.totalQuantity}</TableCell>
                  )}

                  {isColumnVisible('ticksPips') && (
                    <TableCell className="text-muted-foreground px-2 py-1">—</TableCell>
                  )}

                  {isColumnVisible('accountName') && (
                    <TableCell className="text-muted-foreground px-2 py-1">
                      {trade.accountId ? (accounts.find((a) => a.id === trade.accountId)?.name ?? '—') : '—'}
                    </TableCell>
                  )}

                  {isColumnVisible('openDateTime') && (
                    <TableCell className="text-muted-foreground text-xs px-2 py-1">
                      {metrics.openDate ? format(new Date(metrics.openDate), 'MMM dd, yyyy HH:mm') : '—'}
                    </TableCell>
                  )}

                  {isColumnVisible('closeDateTime') && (
                    <TableCell className="text-muted-foreground text-xs px-2 py-1">
                      {metrics.closeDate ? format(new Date(metrics.closeDate), 'MMM dd, yyyy HH:mm') : '—'}
                    </TableCell>
                  )}

                  {isColumnVisible('duration') && (
                    <TableCell className="text-muted-foreground text-xs px-2 py-1">
                      {formatDurationMinutes(metrics.duration)}
                    </TableCell>
                  )}

                  {isColumnVisible('avgEntry') && (
                    <TableCell className="font-mono px-2 py-1">
                      {metrics.avgEntryPrice > 0 ? metrics.avgEntryPrice.toFixed(2) : '—'}
                    </TableCell>
                  )}

                  {isColumnVisible('avgExit') && (
                    <TableCell className="font-mono px-2 py-1">
                      {metrics.avgExitPrice > 0 ? metrics.avgExitPrice.toFixed(2) : '—'}
                    </TableCell>
                  )}

                  {isColumnVisible('initialRisk') && (
                    <TableCell className="font-mono px-2 py-1">
                      {trade.stopLoss !== undefined && trade.stopLoss !== null ? trade.stopLoss.toFixed(2) : '—'}
                    </TableCell>
                  )}

                  {isColumnVisible('initialTarget') && (
                    <TableCell className="font-mono px-2 py-1">
                      {trade.takeProfit !== undefined && trade.takeProfit !== null ? trade.takeProfit.toFixed(2) : '—'}
                    </TableCell>
                  )}

                  {isColumnVisible('grossPnl') && (
                    <TableCell className={cn(
                      'font-mono font-semibold px-2 py-1',
                      isPrivacyMode ? 'text-foreground' : metrics.grossPnl >= 0 ? 'text-profit' : 'text-loss'
                    )}>
                      {maskCurrency(metrics.grossPnl, formatCurrency)}
                    </TableCell>
                  )}

                  {isColumnVisible('netPnl') && (
                    <TableCell className={cn(
                      'font-mono font-semibold px-2 py-1',
                      isPrivacyMode ? 'text-foreground' : metrics.netPnl >= 0 ? 'text-profit' : 'text-loss'
                    )}>
                      {maskCurrency(metrics.netPnl, formatCurrency)}
                    </TableCell>
                  )}

                  {isColumnVisible('realizedRMultiple') && (() => {
                    let rMultiple: number | null = null;
                    if (typeof trade.savedRMultiple === 'number' && trade.savedRMultiple !== 0) {
                      rMultiple = trade.savedRMultiple;
                    } else if (metrics.avgEntryPrice > 0 && metrics.avgExitPrice > 0 && trade.stopLoss && trade.stopLoss > 0) {
                      const entry = metrics.avgEntryPrice;
                      const exit = metrics.avgExitPrice;
                      const sl = trade.stopLoss;
                      const risk = trade.side === 'LONG' ? entry - sl : sl - entry;
                      const realizedPnl = trade.side === 'LONG' ? exit - entry : entry - exit;
                      if (risk > 0) rMultiple = realizedPnl / risk;
                    }
                    return (
                      <TableCell className="font-mono px-2 py-1 text-foreground">
                        {rMultiple !== null ? rMultiple.toFixed(2) : '—'}
                      </TableCell>
                    );
                  })()}

                  {isColumnVisible('plannedRRR') && (
                    <TableCell className="font-mono px-2 py-1 text-foreground">
                      {typeof trade.savedRRR === 'number' ? trade.savedRRR.toFixed(2) : '—'}
                    </TableCell>
                  )}
                  {isColumnVisible('farthestProfitTicks') && (
                    <TableCell className="font-mono text-right px-2 py-1">
                      {typeof trade.preMfeTickPip === 'number' ? trade.preMfeTickPip : ''}
                    </TableCell>
                  )}
                  {isColumnVisible('farthestProfitPrice') && (
                    <TableCell className="font-mono text-right px-2 py-1">
                      {typeof trade.preMfePrice === 'number' ? trade.preMfePrice : ''}
                    </TableCell>
                  )}
                  {isColumnVisible('farthestLossTicks') && (
                    <TableCell className="font-mono text-right px-2 py-1">
                      {typeof trade.preMaeTickPip === 'number' ? trade.preMaeTickPip : ''}
                    </TableCell>
                  )}
                  {isColumnVisible('farthestLossPrice') && (
                    <TableCell className="font-mono text-right px-2 py-1">
                      {typeof trade.preMaePrice === 'number' ? trade.preMaePrice : ''}
                    </TableCell>
                  )}
                  {isColumnVisible('postMaxTickPip') && (
                    <TableCell className="font-mono text-right px-2 py-1">
                      {typeof trade.postMaxTickPip === 'number' ? trade.postMaxTickPip : ''}
                    </TableCell>
                  )}
                  {isColumnVisible('postMaxPrice') && (
                    <TableCell className="font-mono text-right px-2 py-1">
                      {typeof trade.postMaxPrice === 'number' ? trade.postMaxPrice : ''}
                    </TableCell>
                  )}
                  {isColumnVisible('postMinTickPip') && (
                    <TableCell className="font-mono text-right px-2 py-1">
                      {typeof trade.postMinTickPip === 'number' ? trade.postMinTickPip : ''}
                    </TableCell>
                  )}
                  {isColumnVisible('postMinPrice') && (
                    <TableCell className="font-mono text-right px-2 py-1">
                      {typeof trade.postMinPrice === 'number' ? trade.postMinPrice : ''}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export interface TradesTableCardProps {
  /** Pre-filtered trades to display. The component never re-fetches global trades for display. */
  trades: Trade[];
  /** Show the Import button in the action bar. Default true. */
  showImport?: boolean;
  /** Optional empty state copy. */
  emptyState?: { title: string; subtitle: string };
  /** Outer wrapper class override. */
  className?: string;
}

export const TradesTableCard = ({
  trades,
  showImport = true,
  emptyState,
  className,
}: TradesTableCardProps) => {
  // Mutations are global, but they operate on individual ids that are already in `trades`,
  // so they cannot affect other accounts' data.
  const { deleteTrades, bulkAddTrades } = useFilteredTrades();
  const { openModal } = useTradeModal();
  const { accounts } = useAccountsContext();
  const { formatCurrency } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency } = usePrivacyMode();
  const { columns, toggleColumn, isColumnVisible, columnGroups } = useTradesColumnVisibility();

  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tradesPerPage, setTradesPerPage] = useState(50);

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const metricsA = calculateTradeMetrics(a);
      const metricsB = calculateTradeMetrics(b);
      return new Date(metricsB.closeDate || 0).getTime() - new Date(metricsA.closeDate || 0).getTime();
    });
  }, [trades]);

  const totalTrades = sortedTrades.length;
  const totalPages = Math.max(1, Math.ceil(totalTrades / tradesPerPage));
  const startIndex = (currentPage - 1) * tradesPerPage;
  const endIndex = Math.min(startIndex + tradesPerPage, totalTrades);

  const paginatedTrades = useMemo(() => {
    return sortedTrades.slice(startIndex, endIndex);
  }, [sortedTrades, startIndex, endIndex]);

  // Reset to page 1 if current page exceeds new page count
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const allSelected = paginatedTrades.length > 0 && paginatedTrades.every((t) => selectedTrades.has(t.id));
  const someSelected = selectedTrades.size > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedTrades((prev) => {
        const next = new Set(prev);
        paginatedTrades.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedTrades((prev) => {
        const next = new Set(prev);
        paginatedTrades.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const handleTradesPerPageChange = (value: string) => {
    setTradesPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleRowClick = (tradeId: string) => {
    const trade = sortedTrades.find((t) => t.id === tradeId);
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
    const tradesToDuplicate = sortedTrades.filter((t) => selectedTrades.has(t.id));
    const duplicatedTradesData = tradesToDuplicate.map((trade) => {
      const { id, createdAt, updatedAt, ...tradeData } = trade;
      return tradeData;
    });
    bulkAddTrades(duplicatedTradesData);
    setSelectedTrades(new Set());
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          'glass-card rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden',
          className
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
                  <AlertDialogAction onClick={handleDeleteSelected} className="bg-loss hover:bg-loss/90">
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
              columns={columns}
              columnGroups={columnGroups}
              onToggleColumn={toggleColumn}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <TableWithStickyHorizontalScroll
          paginatedTrades={paginatedTrades}
          allSelected={allSelected}
          handleSelectAll={handleSelectAll}
          isColumnVisible={isColumnVisible}
          selectedTrades={selectedTrades}
          setSelectedTrades={setSelectedTrades}
          handleRowClick={handleRowClick}
          isPrivacyMode={isPrivacyMode}
          maskCurrency={maskCurrency}
          formatCurrency={formatCurrency}
          accounts={accounts}
          emptyState={emptyState}
        />

        {totalTrades > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-2 border-t border-border flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Per page:</span>
                <Select value={String(tradesPerPage)} onValueChange={handleTradesPerPageChange}>
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
              <Select value={String(currentPage)} onValueChange={(v) => setCurrentPage(Number(v))}>
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
    </>
  );
};

export default TradesTableCard;
