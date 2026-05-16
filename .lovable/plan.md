## Add "Intraday/Multiday" filter to Basic Filters

Add a new filter row in the Basic Filters section of the Filters popover with a single-select dropdown: **All / Intraday / Multiday**.

- **Intraday**: trade's open date and close date fall on the same calendar day
- **Multiday**: open date and close date are on different calendar days (close > open day)
- **All**: no filtering (default)

### Files to change

1. **`src/contexts/GlobalFiltersContext.tsx`**
   - Add type `HoldingPeriodFilter = 'all' | 'intraday' | 'multiday'`
   - Add state `holdingPeriodFilter` (default `'all'`) + setter
   - Expose via context value and include in `resetFilters` / active-filter logic if present

2. **`src/hooks/useFilteredTrades.ts`** (and/or wherever global filters are applied to trades)
   - When `holdingPeriodFilter !== 'all'`, compute `openDate` and `closeDate` from `calculateTradeMetrics(trade)`, compare the calendar-day portion (using local date — `YYYY-MM-DD`):
     - `intraday`: keep if `openDay === closeDay`
     - `multiday`: keep if `openDay !== closeDay`
   - Skip trades with no `closeDate` (open positions) for both intraday and multiday (exclude them when a holding-period filter is active).

3. **`src/components/layout/AdvancedBasicFiltersSection.tsx`**
   - Add a new `FilterRow` labeled **"Intraday/Multiday"** (icon: `CalendarDays` from lucide-react), placed after "Last Trades".
   - Body: a `Select` with options `All`, `Intraday`, `Multiday`, bound to `holdingPeriodFilter` / `setHoldingPeriodFilter`.
   - `active = holdingPeriodFilter !== 'all'`; toggling off resets to `'all'`.

4. **`src/components/layout/SelectedFiltersBar.tsx`** (if it lists active filters)
   - Add a chip for the active holding-period selection with a clear action that resets it to `'all'`.

### Notes
- Day comparison uses the user's local timezone (consistent with how other date-based filters in the app compare days).
- No backend/database changes — purely client-side filter logic and UI.
