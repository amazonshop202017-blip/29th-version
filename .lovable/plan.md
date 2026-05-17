## Goal

Add a new dashboard widget — **Forex News KPI** — sourced from the Forex News calendar. It is opt-in (only via Widget Library), uses the same `forex-calendar-cache-v1` localStorage as the Forex News page, and triggers the same daily API fetch logic when the widget is mounted on the dashboard so the user doesn't need to open the news page.

## Behavior

- **Default filters (persisted to localStorage):**
  - Currencies: `["USD"]` (multi-select editable)
  - Impacts: `["High"]` (multi-select via 3 colored dots: High/Medium/Low)
  - Stored under a new key, e.g. `forex-calendar-kpi-filters-v1`
- **Columns shown per event:** Currency · Time · Impact (small dot/badge) · Title
- **Grouping:** Events grouped under a sticky "Date" header (e.g. "Mon, May 18"), then events listed beneath, then next date header, etc.
- **Sizing:** `colSpan: 1, rowSpan: 2` — same footprint as `TradeDurationPerformanceChart` (1 col × 2 rows). Scrollable inner body when content overflows.
- **Not added by default** — only appears when user inserts it from Widget Library (like `yearlyCalendar`).

## Caching & API call coordination

Today `calendar.service.ts` already:
- Caches raw events to `localStorage["forex-calendar-cache-v1"]` keyed by today's local date.
- Dedupes concurrent in-flight requests.
- Only fetches once per local calendar day per browser.

Plan:
- The widget calls the **same** `getCalendarEvents()` service / `useCalendarData` hook → automatically reuses the cache and the in-flight dedupe. No duplicate requests whether or not the user opens the Forex News page.
- If the widget is **not** added to the dashboard, nothing on the dashboard imports the service → no API call from dashboard load. (Existing Forex News page behavior unchanged.)
- If the widget **is** added, mounting it on dashboard load triggers the existing daily-cache-check logic exactly once and stores result for both the widget and the Forex News page.

## Files to create

- `src/components/dashboard/ForexNewsKpi.tsx` — new widget
  - Uses `useCalendarData()` and filters events client-side by selected currencies + impacts
  - 3 impact dots (red / orange / gray) at top, multi-currency popover/chips selector, both persisted via small `localStorage` helper
  - Renders date-grouped scrollable list (Currency · Time · impact dot · Title)
  - Card chrome matches other dashboard widgets (same header style as TradeDurationPerformanceChart)

## Files to edit

- `src/pages/Dashboard.tsx`
  - Register `forexNewsKpi` in `CHART_CONFIGS` with `colSpan: 1, rowSpan: 2`
  - Do **not** add it to `DEFAULT_CHART_ORDER` (opt-in only)
- `src/components/dashboard/ChartLibraryModal.tsx`
  - Add `{ id: 'forexNewsKpi', name: 'Forex News', description: 'Upcoming high-impact economic events by currency' }`

## Technical details

- Filters state stored as `{ currencies: string[], impacts: ImpactLevel[] }` in `localStorage["forex-calendar-kpi-filters-v1"]`, with defaults `["USD"]` / `["High"]` on first run.
- Reuse `useCalendarData()` directly — no new fetch logic, no new cache key, no service changes needed.
- Date grouping: reuse `getDateKey` + `formatDateHeader` from existing utils for visual consistency.
- Inner list uses `overflow-y-auto` with a fixed max-height matching the 2-row card body.
- Impact dot legend (top of card): three clickable circles, filled when active, with tooltips "High / Medium / Low".
- Currency selector: compact multi-select (popover with checkboxes for USD/EUR/GBP/JPY/CAD/AUD/NZD/CHF).

## Out of scope

- No changes to `calendar.service.ts`, the Forex News page, or the cache key format.
- No server-side or cross-device sync (per-browser only, as requested).
