## Add Per-Account Currency

### 1. Account model — `src/contexts/AccountsContext.tsx`
- Add optional `currency: CurrencyCode` field to `Account` interface (USD/EUR/INR).
- Update `addAccount` signature to accept `currency` (default `'USD'`) and persist it.
- Update `updateAccount` signature to accept and persist `currency`.
- Add a small migration step in the load effect: any existing account without `currency` gets `'USD'` (or current global currency) so legacy data keeps working.

### 2. New Account modal — `src/components/settings/NewAccountModal.tsx`
- Add `currency` state (default `'USD'`, prefilled from `editingAccount.currency` when editing).
- Restructure the "Starting Account Balance" row into a 2-column flex layout:
  - **Left (≈40%)**: a Currency `Select` showing each option as `<symbol> <code>` — e.g. `$ USD`, `€ EUR`, `₹ INR`.
  - **Right (≈60%)**: existing Starting Balance input. The `currencySymbol` prefix inside the input now reflects the selected currency (not the global one).
- Pass `currency` through `onCreateAccount` / `onUpdateAccount` payloads.
- Reset `currency` to `'USD'` in `resetForm`.

### 3. Settings page — `src/pages/Settings.tsx`
- Update `handleCreateAccount` and `handleUpdateAccount` to forward `currency` to `addAccount` / `updateAccount`.
- Update the Currency Settings section copy: add a small inline note under the description:
  > "This currency is used only when multiple accounts are selected in filters. When a single account is selected, that account's own currency is used."

### 4. Dynamic currency in GlobalFilters — `src/contexts/GlobalFiltersContext.tsx`
- Import `useAccountsContext` is not allowed here (circular). Instead, expose a setter pattern: add an optional `accountCurrencyResolver` consumed via a new lightweight bridge:
  - Add a function `setAccountCurrencyResolver(fn: (accountId: string) => CurrencyCode | undefined)` plus internal state holding the resolver.
  - Compute `effectiveCurrency`:
    - if `selectedAccounts.length === 1` and resolver returns a currency → use that account's currency,
    - otherwise → use the global `currency` from settings.
  - Derive `currencyConfig` and `formatCurrency` from `effectiveCurrency` (rename internal var; the exposed API names stay the same so no consumer changes are required).

### 5. Bridge component — new `src/components/CurrencyAccountBridge.tsx`
- Tiny component mounted inside `AppLayout` (or wherever both providers are available) that:
  - Reads `accounts` from `AccountsContext`.
  - Calls `setAccountCurrencyResolver(id => accounts.find(a => a.id === id)?.currency)` in a `useEffect`.
- Mount it once after both providers exist. This avoids context coupling.

### Technical notes
- All existing consumers of `currencyConfig` / `formatCurrency` continue to work unchanged — they automatically receive the active account's currency when a single account is filtered.
- Storage stays in `localStorage` (`trading-journal-accounts`) — migration is non-destructive.
- Currency codes restricted to `'USD' | 'EUR' | 'INR'` (matches existing `CurrencyCode`).
- No DB or schema changes required.

### Files touched
- `src/contexts/AccountsContext.tsx`
- `src/contexts/GlobalFiltersContext.tsx`
- `src/components/settings/NewAccountModal.tsx`
- `src/pages/Settings.tsx`
- `src/components/CurrencyAccountBridge.tsx` (new)
- `src/components/layout/AppLayout.tsx` (mount bridge)
