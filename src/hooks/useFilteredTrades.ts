import { useFilteredTradesContext as useBaseFilteredTradesContext } from '@/contexts/TradesContext';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { loadRows } from '@/lib/backtestStore';
import { synthesizeTradeFromBacktestRow } from '@/lib/backtestToTrade';
import { useMemo } from 'react';

/**
 * Wrapper hook that provides filtered trades with automatic account filtering.
 * Uses account IDs (UUIDs) for filtering — never account names.
 */
export const useFilteredTrades = () => {
  const { getActiveAccountIds, accounts } = useAccountsContext();
  const { selectedAccounts } = useGlobalFilters();

  // Get active account IDs (excluding archived accounts)
  const activeAccountIds = useMemo(() => getActiveAccountIds(), [getActiveAccountIds]);

  // Bridge: synthesize trades for any backtesting accounts that the user
  // has explicitly selected (via "Deeper Analysis"). Backtesting accounts are
  // never auto-included in "All accounts".
  const extraTrades = useMemo(() => {
    if (!selectedAccounts || selectedAccounts.length === 0) return [];
    const out = [];
    for (const id of selectedAccounts) {
      const acc = accounts.find(a => a.id === id);
      if (!acc || acc.accountMode !== 'backtesting') continue;
      const rows = loadRows(id);
      for (const r of rows) out.push(synthesizeTradeFromBacktestRow(id, r));
    }
    return out;
  }, [selectedAccounts, accounts]);

  return useBaseFilteredTradesContext(activeAccountIds, extraTrades);
};
