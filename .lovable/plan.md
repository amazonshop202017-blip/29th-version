## Goal

Add a "Deeper Analysis" CTA on the Backtest Session page that pivots the user into the rest of the app with this single backtesting account active in the global account filter. Outside of this explicit action, backtesting accounts must remain invisible/excluded everywhere accounts are picked.

## Changes

### 1. "Deeper Analysis" button — `src/pages/backtesting/BacktestSession.tsx`

- In the header action row, place a new golden button immediately to the **left** of `Clear Trades`.
- Style: solid amber/gold background using semantic-friendly Tailwind (e.g. `bg-amber-500 hover:bg-amber-600 text-black`), `Sparkles` (or `LineChart`) icon from lucide-react, label `Deeper Analysis`.
- On click:
  1. Call `setSelectedAccounts([accountId])` from `useGlobalFilters` to scope global filters to only this backtesting account.
  2. Show a `toast.success` like "Analyzing <session name> across the app".
  3. Navigate to `/dashboard`.

### 2. Backtesting account opt-in for the global filter

The existing global account filter UI (sidebar account menu / filter bar) already lists accounts. We need:

- **Default behavior (unchanged for the user):** backtesting accounts are hidden from the account picker AND excluded from "All Accounts" results.
- **Single exception:** when the user clicks Deeper Analysis, that specific backtesting account ID is placed in `selectedAccounts`. The system must respect that selection even though the account is otherwise hidden.

Concretely:
- Locate the account picker component (`SidebarAccountMenu` and any account multi-select used in filter bars/modals). Filter the listed options with `a.accountMode !== 'backtesting'` so backtesting accounts never appear as selectable items.
- Where "All Accounts" expands to a list of IDs (e.g. `useAccountScopedFilteredTrades`, account loops in dashboards), continue to use `getActiveAccountsWithStats` / `getActiveAccountIds`, which already exclude backtesting — no change needed there.
- The trade-filtering pipeline matches on `selectedAccounts` array equality, so a backtesting ID placed there by Deeper Analysis will correctly limit results to that one session's trades.
- When the user changes account selection back to "All Accounts" (clears selection), backtesting is naturally dropped again — matches the requirement that this is a one-shot scope.

### 3. Trades coming from a backtest session

The Backtest Session page stores rows in its own `backtestStore`, not in `TradesContext`. For Deeper Analysis to actually drive the rest of the app's analytics, backtest rows must surface as trades scoped to this account.

Approach: add a read-only bridge in `TradesContext` that, when `selectedAccounts` contains a backtesting account ID, augments the trade list with trades synthesized from that session's rows (mapped via the field catalog: symbol, direction, entry/exit dates, P/L, R, etc.). Synthesized trades are tagged with `accountId = <backtesting account id>` and a `source: 'backtest'` marker so they never leak into normal "All Accounts" views.

### 4. Add Trade popup — hide backtesting accounts

In the main Add/Edit Trade modal (`src/components/trades/TradeModal.tsx`), the Account dropdown must filter out backtesting accounts:

```ts
const selectableAccounts = accounts.filter(a => a.accountMode !== 'backtesting');
```

Apply the same filter to any other account pickers that currently show all accounts (Import flows, Diary link-trade, Compare groups). Backtesting accounts are managed only from the Backtesting page.

## Technical notes

- `selectedAccounts` already drives currency, filters, and trade scoping globally — no schema changes needed.
- The bridge in step 3 is the only place where backtest data leaves its store; it activates strictly when a backtesting account is the sole selected account.
- Golden styling stays inside the component; no new design tokens needed unless you want a reusable `--gold` token (optional follow-up).

## Files to edit

- `src/pages/backtesting/BacktestSession.tsx` — add Deeper Analysis button + handler.
- `src/contexts/TradesContext.tsx` — bridge backtest rows as trades when a backtesting account is selected.
- `src/components/trades/TradeModal.tsx` — filter out backtesting accounts from account dropdown.
- Any other account selectors that currently show all accounts (audit: `SidebarAccountMenu`, `MultiAccountSelect`, `LinkTradeModal`, import modals) — apply `accountMode !== 'backtesting'` filter.