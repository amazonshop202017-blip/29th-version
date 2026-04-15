import type { Account } from '@/contexts/AccountsContext';

/**
 * Centralized account name resolution.
 * All UI components should use this instead of manual accounts.find(...).
 */
export function getAccountName(
  accounts: Account[],
  accountId: string
): string {
  return accounts.find(a => a.id === accountId)?.name ?? 'Unknown Account';
}

/**
 * Get the display-only accountId (business identifier) for an account.
 */
export function getAccountDisplayId(
  accounts: Account[],
  accountId: string
): string | undefined {
  return accounts.find(a => a.id === accountId)?.accountId;
}
