import { useFilteredTradesContext as useBaseFilteredTradesContext } from '@/contexts/TradesContext';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useMemo } from 'react';

/**
 * Wrapper hook that provides filtered trades with automatic account filtering.
 * Uses account IDs (UUIDs) for filtering — never account names.
 */
export const useFilteredTrades = () => {
  const { getActiveAccountIds } = useAccountsContext();
  
  // Get active account IDs (excluding archived accounts)
  const activeAccountIds = useMemo(() => getActiveAccountIds(), [getActiveAccountIds]);
  
  // Call the base hook with active account IDs
  return useBaseFilteredTradesContext(activeAccountIds);
};
