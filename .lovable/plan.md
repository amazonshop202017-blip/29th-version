

## Plan: Replace demo trades table with real Trades-page table (account-scoped)

### Goal
Swap the bottom demo trades table card in `RealPropFirmAccountDetails.tsx` with the **same trades table experience** used on the `/trades` page (full action bar, column settings, pagination, row interactions, privacy mode, outcome coloring, click-to-edit) — but filtered to **only show trades belonging to the current account**.

### Approach
Extract the Trades-page table card into a **reusable component** `TradesTableCard.tsx`, then use it in two places:
- `src/pages/Trades.tsx` (no behavior change — uses globally filtered trades)
- `src/components/propfirm/RealPropFirmAccountDetails.tsx` (passes account-scoped trades)

This avoids code duplication and guarantees the prop-firm details table stays in sync with future Trades-page improvements.

### Files

**Create**
- `src/components/trades/TradesTableCard.tsx` — extracted card containing:
  - Action bar (Select All, Delete, Import, Merge, Duplicate, mobile dropdown, Column settings, Download)
  - `TableWithStickyHorizontalScroll` (moved here)
  - Pagination footer
  - `AccountImportModal` mount
  - `formatDurationMinutes` helper
  
  Props:
  ```ts
  type Props = {
    trades: Trade[];                  // pre-filtered input
    showImport?: boolean;             // default true; false in propfirm context to hide bulk import
    emptyState?: { title: string; subtitle: string };
  };
  ```
  Internally uses: `useTradeModal`, `useGlobalFilters`, `usePrivacyMode`, `useTradesColumnVisibility`, `useAccountsContext`, plus the existing `deleteTrades` / `bulkAddTrades` from `useFilteredTrades` (these are global mutations, fine to call regardless of which subset is displayed).

**Edit**
- `src/pages/Trades.tsx` — replace the inline JSX (lines ~485–710) with `<TradesTableCard trades={sortedTrades} />`. Keep `DashboardMetrics` row above. Remove now-unused state moved into the component.

- `src/components/propfirm/RealPropFirmAccountDetails.tsx` — replace the entire bottom card (lines 511–567) and remove `demoTrades` constant (lines 20–31) and unused imports (`Upload`, `Settings2`, etc. that are no longer used). Insert:
  ```tsx
  <TradesTableCard
    trades={accountTrades}
    emptyState={{
      title: "No trades for this account yet",
      subtitle: "Trades placed on this account will appear here",
    }}
  />
  ```
  `accountTrades` is already memoized and strictly filtered by `t.accountId === account.id` (existing code, line 98–101) — guarantees data isolation.

### Data isolation (per safety requirement)
- `accountTrades` is built from `trades.filter(t => t.accountId === account.id)` and passed as the **only** trade source to the card.
- The card itself never re-fetches global trades for display — it renders exactly what's passed in.
- Mutations (`deleteTrades`, `bulkAddTrades`, `openModal`) operate on individual trade IDs that are already in the filtered set, so they cannot affect other accounts' data.

### Performance
- Sorting by close date (desc) and pagination slicing inside `TradesTableCard` stay wrapped in `useMemo`.
- `accountTrades` and `enriched` in details page already memoized — no recomputation per render.

### Out of scope
- Changing the demo `PropFirmAccountDetails.tsx` (untouched).
- Adding account-specific column defaults (uses the global `useTradesColumnVisibility` so user's preferred columns persist across both pages).
- Per-account metrics row above the table (the existing path-to-funding panel already covers this).

