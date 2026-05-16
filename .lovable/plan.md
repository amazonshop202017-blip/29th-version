## Goal
Clicking any month in the Yearly Calendar widget opens a Day-Details–style popup, but aggregated for the whole month. The popup's "View Details" button closes the popup and sets the global date-range filter to that month (1st → last day), with preset = "custom". No route navigation.

## New component
Create `src/components/dashboard/MonthDetailsModal.tsx` — visually identical to `DayDetailsModal` but with month semantics:

- Props: `{ isOpen, onClose, date: Date /* any date in the month */, trades: Trade[] /* already filtered to that month */ }`.
- Header title: `format(date, 'MMMM yyyy')` (e.g. "March 2026") + Net P&L pill (same `text-profit` / `text-loss` treatment, privacy-masked via `useGlobalFilters().formatCurrency` + `usePrivacyMode().maskCurrency`).
- Header actions (right):
  - Mobile: `Plus` icon-button → "Add Trade" (calls `openModalWithDate` with the 1st of the month at current local time, same pattern as `DayDetailsModal.handleAddTrade`).
  - `FileText` icon-button → "Add Note" (creates a diary note linked to the 1st of the month, title `Month Note: <MMM yyyy>`).
  - Desktop: same actions as full buttons.
- Body metrics grid (identical fields and styling to `DayDetailsModal`):
  - Total Trades, Gross P&L, Winners / Losers, Commissions, Win Rate, Volume, Profit Factor, Avg Duration.
  - Computed from the passed `trades` via `calculateTradeMetrics` — same reducer as `DayDetailsModal.dayStats`.
- Chart slot (left of the metrics, where `IntradayPnLChart` lives in DayDetailsModal):
  - Replace with a compact cumulative daily P&L line for the month using `recharts` `AreaChart` (same minimal styling already used in `DashboardMetrics` microChart: profit/loss-colored gradient, no axes, no tooltip). Group trades by day-of-close, build cumulative series. Same `300×140` footprint on desktop.
- Trades table: reuse `DayTradesTable` as-is (it just lists trades from the passed array).
- Footer: `Cancel` + `View Details`. `View Details` handler:
  ```ts
  setDatePreset('custom');
  setDateRange({ from: startOfMonth(date), to: endOfMonth(date) });
  onClose();
  ```
  No `navigate(...)` call — user explicitly wants to stay on the dashboard with the filter applied.

## Wire into YearlyCalendarWidget
In `src/components/dashboard/YearlyCalendarWidget.tsx`:
1. Add state: `const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);`.
2. Each month tile becomes `cursor-pointer hover:ring-1 hover:ring-primary/40` and gets an `onClick={() => setSelectedMonthIdx(idx)}`. Tiles with `!s.hasData` still open the modal (it gracefully shows the "No trades on this day"-equivalent state — we'll change that copy to "No trades this month").
3. Compute `selectedMonthDate` = `new Date(year, selectedMonthIdx, 1)` and `selectedMonthTrades` by filtering `filteredTrades` to those whose `calculateTradeMetrics(t).closeDate` falls in the selected `year`/`monthIdx`.
4. Render `<MonthDetailsModal isOpen={selectedMonthIdx !== null} onClose={() => setSelectedMonthIdx(null)} date={selectedMonthDate} trades={selectedMonthTrades} />`.

## Empty-state copy
In `MonthDetailsModal`, where DayDetailsModal shows "No trades on this day", show "No trades this month".

## Out of scope
- No changes to `DayDetailsModal` or the global filter contract.
- No new routes.
- Yearly widget tiles for other dashboard widgets are untouched.