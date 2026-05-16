## Goal
Add a new "Yearly Calendar" widget to the dashboard. Spans 2 columns × 1 row in the chart grid. Shows months Jan–Jun on row 1 and Jul–Dec on row 2 with per-month P&L, trade count, and R. Year is navigable via left/right arrows and a clickable year dropdown (same pattern as the Monthly Calendar widget).

## New component
Create `src/components/dashboard/YearlyCalendarWidget.tsx`:

- Wrapper: `glass-card rounded-xl p-3 md:p-6 h-full` + framer-motion fade/slide (matches `MonthlyPerformanceCalendar`).
- Header row:
  - Left: ChevronLeft button → previous year, then a `YearDropdown` (reusing the pattern from `src/components/reports/YearlyCalendar.tsx` — clickable year text with chevron, opens a popover of ±10 years), then ChevronRight button.
  - Right: compact summary chips (label muted, value bold) for the selected year:
    - `P&L` (profit-text / loss-text via existing classes, formatted with `useGlobalFilters().formatCurrency` and privacy-masked)
    - `Trades` (uses pluralized "trades" label per project memory)
    - `R` (positive → profit-text, negative → loss-text)
- Body: a single `grid grid-cols-6 gap-2` (no nested 2 rows needed — 12 items, 6 cols = 2 rows). On mobile collapse to `grid-cols-3` then `sm:grid-cols-6`.
- Each month tile:
  - `rounded-lg border border-border/60 p-3 cursor-pointer transition-colors hover:bg-accent/40` (no aggressive heatmap — keep sober, the P&L value carries the color).
  - Top: month short name uppercase (`text-[11px] tracking-wider text-muted-foreground`), e.g. "JAN".
  - Middle: P&L value `text-xl md:text-2xl font-bold font-mono` colored `profit-text` / `loss-text`. If no trades → render an em dash `—` in `text-muted-foreground`.
  - Bottom row (one line): `{n} trades` (muted) · separator · `{r}R` (profit/loss colored). Same typography conventions as the Monthly Calendar tiles. If no data → "No trades" muted.
  - Current month gets a subtle `ring-1 ring-primary/30` highlight.
  - Click handler: no modal in v1 (out of scope — image doesn't show one). Keeps it a pure KPI tile. Hover only.

## Data
Use `useFilteredTrades()` + `calculateTradeMetrics(trade)` (same as Monthly Calendar). Build a memoized map keyed by `YYYY-MM` for trades whose `closeDate` falls in the selected year, accumulating `netPnl`, `tradeCount`, and `rMultiple` (using `trade.savedRMultiple` when finite — mirrors Monthly Calendar's logic). Year totals for the header chips are computed from the same map.

## Dashboard wiring
In `src/pages/Dashboard.tsx`:
- Import the new component.
- Add `yearlyCalendar: { component: YearlyCalendarWidget, colSpan: 2, rowSpan: 1 }` to `CHART_CONFIGS`.
- Append `'yearlyCalendar'` to `DEFAULT_CHART_ORDER` so existing users see it after the current widgets (their saved preference order won't include it; they can add from the library).

In `src/components/dashboard/ChartLibraryModal.tsx`:
- Add `{ id: 'yearlyCalendar', name: 'Yearly Calendar', description: '12-month overview with P&L, trades and R per month' }` to `WIDGET_LIST`.

## Out of scope
- No month-click drill-down modal (reference image doesn't imply one).
- No heatmap background coloring of tiles (kept sober per existing dashboard typography rules).
- No changes to the existing `reports/YearlyCalendar.tsx`.