import { useEffect } from 'react';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';

/**
 * Wires AccountsContext into GlobalFiltersContext so that the active currency
 * can resolve to the currently filtered single account's own currency.
 * Mount once inside both providers.
 */
export const CurrencyAccountBridge = () => {
  const { accounts } = useAccountsContext();
  const { setAccountCurrencyResolver } = useGlobalFilters();

  useEffect(() => {
    setAccountCurrencyResolver((accountId: string) => {
      return accounts.find(a => a.id === accountId)?.currency;
    });
    return () => setAccountCurrencyResolver(null);
  }, [accounts, setAccountCurrencyResolver]);

  return null;
};
