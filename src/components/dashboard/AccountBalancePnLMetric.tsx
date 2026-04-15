import { useAccountsContext } from '@/contexts/AccountsContext';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { useMemo } from 'react';
import { calculateTradeMetrics } from '@/types/trade';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const AccountBalancePnLMetric = () => {
  const { accounts, transactions, getActiveAccountIds } = useAccountsContext();
  const { filteredTrades, stats } = useFilteredTrades();
  const { formatCurrency } = useGlobalFilters();
  const { isPrivacyMode, maskCurrency } = usePrivacyMode();

  const { accountBalance, pnl, closedTradesCount } = useMemo(() => {
    const activeIds = getActiveAccountIds();
    const activeAccounts = accounts.filter(a => activeIds.includes(a.id));

    // Calculate total balance across active accounts (starting + deposits - withdrawals)
    let totalBaseBalance = 0;
    activeAccounts.forEach(account => {
      const accountTxns = transactions.filter(t => t.accountId === account.id);
      const deposits = accountTxns.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
      const withdrawals = accountTxns.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);
      totalBaseBalance += account.startingBalance + deposits - withdrawals;
    });

    // P&L from closed trades only
    const closedTrades = filteredTrades.filter(t => calculateTradeMetrics(t).positionStatus === 'CLOSED');
    const closedPnl = closedTrades.reduce((sum, t) => sum + calculateTradeMetrics(t).netPnl, 0);

    return {
      accountBalance: totalBaseBalance + closedPnl,
      pnl: closedPnl,
      closedTradesCount: closedTrades.length,
    };
  }, [accounts, transactions, filteredTrades, getActiveAccountIds]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs text-muted-foreground">Account balance & P&L</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              Current account balance with the total P&L for all closed trades.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{closedTradesCount}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${isPrivacyMode ? 'text-foreground' : accountBalance >= 0 ? 'profit-text' : 'loss-text'}`}>
        {maskCurrency(accountBalance, formatCurrency)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        P&L: <span className={`font-mono font-medium ${isPrivacyMode ? 'text-foreground' : pnl >= 0 ? 'profit-text' : 'loss-text'}`}>
          {maskCurrency(pnl, formatCurrency)}
        </span>
      </p>
    </div>
  );
};
