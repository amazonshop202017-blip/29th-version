

# Data Model Refactor — UUID-Based Relationships

## Summary

Remove all `accountName` and `accountNames` fields from data structures. Standardize on `account.id` (UUID) for all relationships. Create a centralized `getAccountName(accountId)` helper. Apply safe migration for legacy data.

---

## Current State

| Entity | Current relationship field | How it filters/matches |
|--------|---------------------------|----------------------|
| `Trade` | `accountName: string` | Name-based |
| `TpSlRule` | `accountIds: string[]` + `accountNames: string[]` | Name-based (`accountNames.includes(trade.accountName)`) |
| `FeeRule` | Same as TpSlRule | Name-based |
| `TickPipRule` | Same as TpSlRule | Name-based |
| `Transaction` | `accountId: string` (already UUID) | UUID-based (correct) |
| `GlobalFilters.selectedAccounts` | `string[]` | Name-based |
| `AccountsContext.calculateAccountStats` | `t.accountName === account.name` | Name-based |

---

## Step 1 — Create Centralized Helper

**New file: `src/lib/accountUtils.ts`**

```typescript
import type { Account } from '@/contexts/AccountsContext';

export function getAccountName(
  accounts: Account[],
  accountId: string
): string {
  return accounts.find(a => a.id === accountId)?.name ?? 'Unknown Account';
}

export function getAccountIds(
  accounts: Account[],
  accountId: string
): string | undefined {
  return accounts.find(a => a.id === accountId)?.accountId;
}
```

No ambiguous `id` parameter — always `accountId` which refers to `account.id` (UUID).

---

## Step 2 — Update Trade Type

**File: `src/types/trade.ts`**

- Remove `accountName: string` from `Trade` interface
- Keep `accountId?: string` (rename semantics: this IS the UUID, matches `account.id`)
- Make `accountId` required: `accountId: string`

---

## Step 3 — Update Rule Interfaces

**Files: `TpSlSettings.tsx`, `FeesSettings.tsx`, `SymbolTickSizeContext.tsx`, `feeCalculation.ts`, `tpslCalculation.ts`**

For `TpSlRule`, `FeeRule`, `TickPipRule`:
- Remove `accountName?: string` (deprecated single)
- Remove `accountNames: string[]`
- Keep `accountIds: string[]` (these store `account.id` UUIDs)
- Remove deprecated `accountId?: string` (single legacy)

All matching functions change from:
```
r.accountNames.includes(trade.accountName)
```
to:
```
r.accountIds.includes(trade.accountId)
```

---

## Step 4 — Update Transaction Type

**File: `src/contexts/AccountsContext.tsx`**

`Transaction` interface — add `userId: string` (required). `accountId` already uses UUID correctly.

---

## Step 5 — Update Global Filters

**File: `src/contexts/GlobalFiltersContext.tsx`**

`selectedAccounts: string[]` — no type change needed, but semantics change: stores UUIDs instead of names.

---

## Step 6 — Update Filtering Logic

**File: `src/contexts/TradesContext.tsx`**

Change account filtering from:
```typescript
accountNames.includes(trade.accountName)
selectedAccounts.includes(trade.accountName)
```
to:
```typescript
activeAccountIds.includes(trade.accountId)
selectedAccounts.includes(trade.accountId)
```

**File: `src/hooks/useFilteredTrades.ts`**

Change from passing `activeAccountNames` to passing `activeAccountIds` (array of `account.id` UUIDs from non-archived accounts).

**File: `src/contexts/AccountsContext.tsx`**

- `calculateAccountStats`: change `t.accountName === account.name` to `t.accountId === account.id`
- Rename `getActiveAccountNames()` to `getActiveAccountIds()` returning `account.id[]`
- Remove `deleteTradesByAccountName` from TradesContext (use `deleteTradesByAccountId` only)

**File: `src/pages/DayView.tsx`**

Change filtering from `trade.accountName` to `trade.accountId`.

---

## Step 7 — Update Rule Lookup Functions

**File: `src/lib/feeCalculation.ts`**

`findMatchingFeeRule(rules, accountId, symbol)` — match via `r.accountIds.includes(accountId)`

**File: `src/lib/tpslCalculation.ts`**

`findMatchingTpSlRule(rules, accountId, symbol)` — match via `r.accountIds.includes(accountId)`

**File: `src/contexts/SymbolTickSizeContext.tsx`**

- `getTickSizeForAccountSymbol(accountId, symbol)` — match via `r.accountIds.includes(accountId)`
- `getContractSizeForAccountSymbol(accountId, symbol)` — same

---

## Step 8 — Update UI Components

**All rule settings (TpSlSettings, FeesSettings, SymbolTickSizeManagement)**:
- When saving rules, only store `accountIds` (UUIDs), drop `accountNames`
- When displaying, resolve names via `getAccountName(accounts, id)`
- Remove `resolvedNames` variable

**TradeModal.tsx**:
- Save `accountId` (UUID) directly on trade, remove `accountName`
- When editing, read `trade.accountId` directly instead of looking up via name

**Trades.tsx**:
- Display column: use `getAccountName(accounts, trade.accountId)` instead of `trade.accountName`

**Settings.tsx**:
- Replace `trades.filter(t => t.accountName === account.name)` with `trades.filter(t => t.accountId === account.id)`
- Remove `deleteTradesByAccountName` call

**GlobalHeader.tsx / AdvancedFiltersPanel.tsx**:
- Account selector: store/compare `account.id` UUIDs, display `account.name`

---

## Step 9 — Safe Migration Logic

**File: `src/hooks/useTrades.ts`**

Add migration step for legacy trades:
```
if (trade.accountId) → keep as-is
else if (trade.accountName):
  - find accounts where account.name === trade.accountName
  - if exactly 1 match → set trade.accountId = match.id
  - if 0 or 2+ matches → log warning, leave accountId empty
  - delete trade.accountName
```

Migration needs access to accounts list — pass it as parameter or load from localStorage directly.

**Rule migration** in TpSlSettings, FeesSettings, SymbolTickSizeContext:
- If rule has `accountNames` but not `accountIds`: resolve each name to UUID (same safe logic)
- Drop `accountNames` after migration

---

## Step 10 — Account Creation Validation

**File: `src/contexts/AccountsContext.tsx`**

- `addAccount` already generates `id` (UUID) and `accountId` (display) — no change needed
- Add validation: reject if `name` is empty (already trimmed, just add check)

---

## Files Changed (estimated ~25 files)

| Category | Files |
|----------|-------|
| Types | `trade.ts` |
| Contexts | `AccountsContext.tsx`, `TradesContext.tsx`, `GlobalFiltersContext.tsx`, `SymbolTickSizeContext.tsx` |
| Hooks | `useTrades.ts`, `useFilteredTrades.ts` |
| Lib | `feeCalculation.ts`, `tpslCalculation.ts`, `accountUtils.ts` (new) |
| Settings UI | `TpSlSettings.tsx`, `FeesSettings.tsx`, `SymbolTickSizeManagement.tsx`, `MultiAccountSelect.tsx` |
| Trade UI | `TradeModal.tsx`, `Trades.tsx` |
| Pages | `Settings.tsx`, `DayView.tsx` |
| Dashboard | `AccountBalancePnLMetric.tsx` |
| Filters | `GlobalHeader.tsx`, `AdvancedFiltersPanel.tsx`, `SelectedFiltersBar.tsx` |
| Other | Any remaining `accountName` references |

---

## Assessment

These changes are well-aligned for a production-grade system:

1. **UUID-only relationships** — correct for database normalization and prevents breakage when account names change
2. **Centralized helper** — single point of failure, easy to test, consistent display
3. **Safe migration** — the ambiguity guard (skip multi-match) prevents silent data corruption
4. **No name storage** — eliminates stale data entirely

**One concern**: The migration in `useTrades.ts` needs access to the accounts list. Since trades load before accounts in the provider tree, the migration will load accounts directly from localStorage (same storage key) rather than depending on context. This is safe for a localStorage-based app.

**Recommendation**: This plan is solid. The only addition I'd suggest post-implementation is a one-time migration report (console log) showing how many trades were migrated vs skipped, so you can verify data integrity.

