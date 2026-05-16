## Week toggle for Day View

Adds the Week mode currently empty in `src/pages/DayView.tsx`. Day mode is untouched.

### What a week card shows (matches reference layout)

1. **Header row**
   - Chevron toggle, week range label (e.g. `Feb 01 - Feb 07, 2026`), bullet, `Net P&L <value>` colored profit/loss/foreground (privacy-aware), all matching DayCard styling.

2. **7-day pill row** (Sun → Sat)
   - Each pill labeled `Sun 1`, `Mon 2`, … with weekday + day-of-month.
   - If the day has trades: show net P&L and trade count ("1 trade" / "N trades" — uses Core pluralization rule), pill tinted green/red based on profit/loss (using `--profit` / `--loss` HSL tokens, soft background like existing month-calendar bubbles).
   - If no trades: muted neutral background, only label visible.
   - Pills laid out as 7 equal columns on desktop; horizontally scrollable on mobile.

3. **Chart + Metrics row** (same flex layout as DayCard)
   - **Chart (left, ~300px)**: a line chart (no candles) of cumulative net P&L across the week, built from the week's trades using the same approach as `IntradayPnLChart` (reuse it — it already renders a line/area; we feed it the week's trades sorted by openDate). No change in chart component needed.
   - **Metrics (right, 2×4 grid)**: the exact same 8 metrics as DayCard in the same order — Total Trades, Winners, Gross P&L, Commissions, Winrate, Losers, Volume, Profit Factor — using identical formatting, privacy masking, and color rules.

4. **Expanded trades table**
   - Reuses `DayTradesTable` with all of the week's trades, identical columns and layout to Day view.

### Files / changes

- **New** `src/components/dayview/WeekCard.tsx` — mirrors `DayCard.tsx` structure (header, pill row, chart+metrics, expandable table). Same dayStats reducer logic, just over a week's trades.
- **Edit** `src/pages/DayView.tsx`
  - Add a `weekGroups` memo: group `filteredTrades` into ISO weeks (Sunday–Saturday to match the reference) keyed by week start; sort descending.
  - When `viewMode === 'week'`, render `WeekCard` per group (empty-state fallback if no weeks). When `'day'`, render existing `DayCard`s unchanged.
  - Pass the week's date range + the 7 day-buckets into `WeekCard`.

### Technical notes

- Use `date-fns` `startOfWeek`/`endOfWeek` with `{ weekStartsOn: 0 }` (Sun) to match the reference.
- Day-pill bucketing computed inside `WeekCard` from the trades + week start (no need to pre-bucket in page).
- All colors via existing `--profit` / `--loss` tokens; pill tints use `bg-profit/10` and `bg-loss/10` to match the soft red/green in the reference.
- Privacy mode, currency formatting, and outcome classification all come from existing hooks (`useGlobalFilters`, `usePrivacyMode`) — no new logic.
- No changes to `DayTradesTable`, `IntradayPnLChart`, or any Day-mode component.