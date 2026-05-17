import { useMemo } from 'react';
import { useAccountsContext, type Account } from '@/contexts/AccountsContext';
import { useChallengesContext, type Challenge } from '@/contexts/ChallengesContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { usePropFirmFilters, type PropFirmFilterPhase } from '@/contexts/PropFirmFiltersContext';

export function usePropFirmFiltered() {
  const { accounts } = useAccountsContext();
  const { challenges } = useChallengesContext();
  const { transactions } = useTransactionsContext();
  const { applied } = usePropFirmFilters();

  return useMemo(() => {
    const challengeMap = new Map(challenges.map(c => [c.challengeId, c]));

    const accountPasses = (a: Account) => {
      const ch = a.challengeId ? challengeMap.get(a.challengeId) : undefined;
      if (applied.firms.length) {
        const firm = ch?.firm ?? a.name;
        if (!applied.firms.includes(firm)) return false;
      }
      if (applied.phases.length) {
        if (!a.phase || !applied.phases.includes(a.phase)) return false;
      }
      if (applied.statuses.length) {
        const st = a.status;
        // Filter only exposes active/breached/funded. 'completed' is treated as active (in progress lifecycle).
        const effective = st === 'completed' ? 'active' : st;
        if (!effective || !applied.statuses.includes(effective as any)) return false;
      }
      if (applied.sizes.length) {
        const size = ch?.balanceAmount ?? a.startingBalance;
        if (!applied.sizes.includes(size)) return false;
      }
      if (applied.steps.length) {
        if (!ch || !applied.steps.includes(ch.steps)) return false;
      }
      if (applied.strategies.length) {
        const setups = ch?.setups ?? [];
        if (!setups.some(s => applied.strategies.includes(s))) return false;
      }
      return true;
    };

    const challengePasses = (c: Challenge) => {
      if (applied.firms.length && !applied.firms.includes(c.firm)) return false;
      if (applied.statuses.length && !applied.statuses.includes(c.status as any)) return false;
      if (applied.sizes.length && !applied.sizes.includes(c.balanceAmount)) return false;
      if (applied.steps.length && !applied.steps.includes(c.steps)) return false;
      if (applied.strategies.length && !c.setups.some(s => applied.strategies.includes(s))) return false;
      if (applied.phases.length) {
        const phase: PropFirmFilterPhase = c.status === 'funded' ? 'funded' : 'evaluation';
        if (!applied.phases.includes(phase)) return false;
      }
      return true;
    };

    const filteredAccounts = accounts.filter(accountPasses);
    const filteredChallenges = challenges.filter(challengePasses);
    const allowedAccountIds = new Set(filteredAccounts.map(a => a.id));
    const allowedChallengeIds = new Set(filteredChallenges.map(c => c.challengeId));

    const filteredTransactions = transactions.filter(t => {
      if (t.challengeId) return allowedChallengeIds.has(t.challengeId);
      if (t.accountId) return allowedAccountIds.has(t.accountId);
      if (applied.firms.length && !applied.firms.includes(t.firm)) return false;
      return true;
    });

    return {
      accounts: filteredAccounts,
      challenges: filteredChallenges,
      transactions: filteredTransactions,
    };
  }, [accounts, challenges, transactions, applied]);
}
