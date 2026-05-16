import { useEffect } from 'react';
import { useOptionalAccountsContext, type Account } from '@/contexts/AccountsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';

const EMPTY_ACCOUNTS: Account[] = [];

/**
 * Wires AccountsContext into GlobalFiltersContext so that the active currency
 * can resolve to the currently filtered single account's own currency.
 * Mount once inside both providers.
 */
export const CurrencyAccountBridge = () => {
  const accountsContext = useOptionalAccountsContext();
  const accounts = accountsContext?.accounts ?? EMPTY_ACCOUNTS;
  const { setAccountCurrencyResolver } = useGlobalFilters();

  useEffect(() => {
    setAccountCurrencyResolver((accountId: string) => {
      return accounts.find(a => a.id === accountId)?.currency;
    });
    return () => setAccountCurrencyResolver(null);
  }, [accounts, setAccountCurrencyResolver]);

  return null;
};
