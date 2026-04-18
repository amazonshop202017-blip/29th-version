## Bug

In `src/contexts/TradesContext.tsx` (lines 141–145), when "All accounts" is selected (`selectedAccounts.length === 0`), filtering by active account IDs is **skipped entirely** if there are zero active accounts:

```ts
if (accountIds.length > 0) {
  const activeSet = new Set(accountIds);
  filtered = filtered.filter(trade => activeSet.has(trade.accountId));
}
```

When the user has 0 active accounts (only archived ones), `accountIds.length === 0`, so the `if` is false and **all trades pass through unfiltered** — including trades from the archived account. That's why dashboard analytics still show data.

The same defensive bug exists for the explicit-selection branch (lines 149–153): `activeSet` is `null` when no active accounts exist, allowing archived selections through.

## Fix

Remove the `accountIds.length > 0` guard. If there are zero active accounts, the result should be **zero trades**, not all trades.

In `src/contexts/TradesContext.tsx`, replace the block:

```ts
if (selectedAccounts.length === 0) {
  if (accountIds.length > 0) {
    const activeSet = new Set(accountIds);
    filtered = filtered.filter(trade => activeSet.has(trade.accountId));
  }
} else {
  const activeSet = accountIds.length > 0 ? new Set(accountIds) : null;
  const selectedSet = new Set(selectedAccounts);
  filtered = filtered.filter(trade =>
    selectedSet.has(trade.accountId) && (!activeSet || activeSet.has(trade.accountId))
  );
}
```

with:

```ts
const activeSet = new Set(accountIds);
if (selectedAccounts.length === 0) {
  // "All accounts" = all ACTIVE accounts only (never archived).
  // If there are zero active accounts, result is zero trades.
  filtered = filtered.filter(trade => activeSet.has(trade.accountId));
} else {
  // Explicit selection — intersect with active accounts so archived selections drop out.
  const selectedSet = new Set(selectedAccounts);
  filtered = filtered.filter(trade =>
    selectedSet.has(trade.accountId) && activeSet.has(trade.accountId)
  );
}
```

## Files

- `src/contexts/TradesContext.tsx` — fix filter guard so empty-active-set yields empty result.

DayView already has the correct behavior (always intersects with `activeSet`), so no change needed there.

## Result

After this fix, with 0 active accounts:

- Dashboard, Trades, Reports, Chartroom, Day View → all show 0 trades / empty stats.
- The archived Step 1 account's data will no longer leak into analytics. 

analytics on any page must be as per filter, and in all accounts, it should have shown by only non archive account means they are active could be status ('active'| 'completed' |'funded') but they definitely should not be archived. 

&nbsp;