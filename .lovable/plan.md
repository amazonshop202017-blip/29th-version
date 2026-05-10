## Backtesting — Sidebar entry, sessions as accounts, custom-field trades

A standalone Backtesting section. Each "session" is an Account with `accountMode: 'backtesting'`, kept fully isolated from the rest of the app (Trades page, Dashboard, Reports, filters, etc.). Trades inside a backtesting session are free-form rows with a user-defined field schema, stored in their own localStorage namespace — they never enter the main `TradesContext`.

### 1. Sidebar

`src/components/layout/Sidebar.tsx` — add a new `NavItem` directly under `Dashboard` (above Prop Firm):

- Icon: `History` from lucide-react
- Label: `Backtesting`
- Path: `/backtesting`

### 2. Account mode

Extend `AccountMode` in `src/contexts/AccountsContext.tsx`:

```ts
export type AccountMode = 'normal' | 'propfirm' | 'backtesting';
```

Backtesting accounts must be hidden everywhere except the Backtesting page. Audit and add a `mode !== 'backtesting'` exclusion in:

- `getActiveAccountsWithStats` / `getAllAccountsWithStats` callers used for global account selectors and dashboards
- `MultiAccountSelect`, `SidebarAccountMenu`, `AccountsContext` filter dropdown, Settings → Accounts list, PropFirm pages
- `useFilteredTrades`, `GlobalFiltersContext` initial selection
- Any place iterating `accounts` for display

The cleanest approach: add a helper `getNonBacktestingAccounts()` and update the existing list getters to exclude backtesting by default, with a new `getBacktestingAccounts()` for the new page only.

### 3. Routing

`src/App.tsx`:

```
/backtesting              → BacktestingHome     (card grid + "Add Session")
/backtesting/:accountId   → BacktestSession     (trade entry page)
```

Both inside the existing `AppLayout`.

### 4. Backtesting Home (`src/pages/backtesting/BacktestingHome.tsx`)

- Page title in global header (per project rule).
- Top-right `+ Add Session` button styled like PropFirm's "Add Challenge".
- Card grid (mirror `RealAccountCard` layout) of all accounts where `accountMode === 'backtesting'`. Each card shows:
  - Session name (bold)
  - Total Trades, Wins, Losses, Win Rate
  - Created date (small)
- Card actions via 3-dot menu (`DropdownMenu`):
  - **Rename** — inline dialog with name input
  - **Clear Trades** — confirm `AlertDialog`, deletes all backtest trades+fields rows for this accountId (keeps the session)
  - **Delete Session** — confirm `AlertDialog` (matches Settings → Accounts delete pattern), deletes the account + its trades + its field schema
- Click card → navigate to `/backtesting/:accountId`.

### 5. Add Session modal (`AddBacktestSessionModal.tsx`)

- Single field: **Session Name** (required).
- On Save: `addAccount(name, 0, 'backtesting', undefined, 'USD')` → navigate to the new session.
- No starting balance, no currency, no other fields.

### 6. Per-session storage (`src/lib/backtestStore.ts`)

Two localStorage keys, both keyed by accountId:

```ts
// tv-backtest-fields:<accountId>  →  FieldDef[]
// tv-backtest-trades:<accountId>  →  BacktestRow[]

export type FieldType = 'text' | 'number' | 'date' | 'select';
export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for 'select'
  builtin?: boolean;  // required defaults can't be removed
}
export interface BacktestRow {
  id: string;
  createdAt: string;
  values: Record<string, string | number | null>;
  // Convenience: derived 'outcome' for win/loss tally
  outcome?: 'win' | 'loss' | 'be';
}
```

Defaults inserted on first session open (built-in, removable except `outcome`):

| id        | label      | type   | required |
|-----------|-----------|--------|----------|
| date      | Date      | date   | true     |
| symbol    | Symbol    | text   | true     |
| outcome   | Outcome   | select (Win/Loss/BE) | true |
| rr        | R Multiple| number | false    |
| notes     | Notes     | text   | false    |

A small React hook `useBacktestSession(accountId)` exposes `{fields, rows, addField, removeField, addRow, updateRow, deleteRow, clearRows}` and persists to localStorage on every change.

### 7. Session page (`src/pages/backtesting/BacktestSession.tsx`)

Layout, top to bottom:

1. **Header strip**: Back button → `/backtesting`. Editable session name. Right side: `Clear Trades`, `Delete Session` buttons (same dialogs as home).
2. **Stats bar** (read-only): Total Trades, Wins, Losses, Win Rate, Avg R, Total R. Computed from current `rows`.
3. **Toolbar**:
   - `+ Add Field` (opens AddFieldModal)
   - `+ Add Trade` (opens AddTradeModal — only fields the user defined; required fields validated)
4. **Trades table**: columns = current `fields` order. Each row shows values; row-level Edit / Delete actions.

### 8. Add Field modal (`AddFieldModal.tsx`)

Mirrors the "Add Widget" popup pattern from the dashboard (centered modal, big button per choice):

- Step 1: pick **Field Type** — Text / Number / Date / Select (4 cards).
- Step 2: enter **Label**, mark **Required** (toggle), and for Select type list comma-separated options.
- Save → appends to the session's `fields[]` and immediately becomes available in Add Trade.
- Built-in fields cannot be deleted; user-added fields show a small `×` in the table column header.

### 9. Add Trade modal (`AddTradeModal.tsx`)

- Renders inputs dynamically from `fields[]`:
  - text → `Input`
  - number → `Input type=number`
  - date → `AppDatePicker`
  - select → `Select`
- Required fields show `*` and block submit when empty.
- Save → appends a `BacktestRow` to the session's `rows[]`.

### 10. Stat math

Win/Loss/Win-rate uses the `outcome` built-in field. If user removes `outcome`, the stats bar shows `—` for these (table still works). Avg R / Total R use the `rr` built-in if present.

### 11. Files to create / edit

Create:
- `src/pages/backtesting/BacktestingHome.tsx`
- `src/pages/backtesting/BacktestSession.tsx`
- `src/components/backtesting/BacktestSessionCard.tsx`
- `src/components/backtesting/AddBacktestSessionModal.tsx`
- `src/components/backtesting/AddFieldModal.tsx`
- `src/components/backtesting/AddTradeModal.tsx`
- `src/components/backtesting/BacktestTradesTable.tsx`
- `src/lib/backtestStore.ts`
- `src/hooks/useBacktestSession.ts`

Edit:
- `src/contexts/AccountsContext.tsx` — add `'backtesting'` to `AccountMode`; add helpers `getBacktestingAccounts()` and exclusion of backtesting from existing list getters.
- `src/components/layout/Sidebar.tsx` — add Backtesting nav item.
- `src/App.tsx` — register two new routes.
- Any account-selector component that surfaces accounts globally — confirm backtesting accounts are filtered out (`SidebarAccountMenu`, `MultiAccountSelect`, Settings Accounts list, GlobalFilters initial selection). Touch only what's needed to keep them hidden outside Backtesting.

### Out of scope

- Linking backtest trades to real Strategies / Setups
- Importing CSV
- Cross-session comparison
- Cloud sync (localStorage only — matches current app)
