## Goal

Add a new **Forex News Calendar** page that mirrors the reference project (`Hello Import Starter`, id `8f117c85-eee2-4a2e-bfbe-1e1adc061f81`) exactly — same UI, same API integration (ForexFactory via faireconomy.media), same hooks/services. Add a sidebar button to reach it.

## What gets copied

The reference project keeps the entire feature self-contained inside `src/modules/forex-calendar/`. The whole folder will be copied over verbatim:

```
src/modules/forex-calendar/
  components/  (CalendarHeader, DateTabs, EventGroup, EventRow, Filters, TimezoneBar)
  hooks/       (useCalendarData, useFilters)
  pages/       (ForexCalendarPage)
  services/    (calendar.service.ts)
  types/       (calendar.types.ts)
  utils/       (date.utils, format.utils)
  index.ts
```

The module only depends on `react` and `lucide-react` (both already present) plus Tailwind utility classes — no extra packages needed. It does not import anything from outside the module, so it drops in cleanly.

## API proxy (the only infra change)

Reference uses a Vite dev proxy:
```
/api/calendar  ->  https://nfs.faireconomy.media
```
which rewrites `/api/calendar/ff_calendar_thisweek.json` to `https://nfs.faireconomy.media/ff_calendar_thisweek.json`.

I will add the same proxy block to the current project's `vite.config.ts`. This preserves the exact same `apiUrl` used in `calendar.service.ts` and matches the reference behavior 1:1 in dev. (For production preview, the proxy works the same way through Vite's preview server; if the user later deploys, we can switch to a direct URL or edge function — out of scope for this task.)

## Routing

In `src/App.tsx`:
- Import the page: `import ForexNews from "./pages/ForexNews"`
- Add route inside the authenticated `AppLayout` Routes block:
  `<Route path="/forex-news" element={<ForexNews />} />`

Create a thin wrapper page `src/pages/ForexNews.tsx` that simply renders `<ForexCalendarPage />` from the module. This keeps it consistent with how other pages are structured in this project.

## Sidebar entry

In `src/components/layout/Sidebar.tsx`:
- Import a `Newspaper` (or `CalendarClock`) icon from `lucide-react`.
- Add a new entry to the `toolsItems` array (the user said "above tools, add sidebar button" — interpreted as an entry visible alongside/at top of the Tools group, since Tools is the natural home for a calendar utility):

```ts
const toolsItems = [
  { label: 'Forex News Calendar', path: '/forex-news' },
  { label: 'Monte Carlo', path: '/tools/monte-carlo' },
  { label: 'Streak Analysis', path: '/tools/streak-analysis' },
  ...
];
```

If the user instead wants it as a **top-level standalone sidebar item** (its own row with an icon, like Dashboard / Prop Firm), I'll add a `NavItem` block right above the Tools group with a `Newspaper` icon and path `/forex-news`. I'll go with the **standalone top-level item placed directly above Tools** — that matches the phrasing "above tools, add sidebar button" most literally.

## Files to add / edit

**New files (copied verbatim from reference project):**
- `src/modules/forex-calendar/index.ts`
- `src/modules/forex-calendar/pages/ForexCalendarPage.tsx`
- `src/modules/forex-calendar/components/CalendarHeader.tsx`
- `src/modules/forex-calendar/components/DateTabs.tsx`
- `src/modules/forex-calendar/components/EventGroup.tsx`
- `src/modules/forex-calendar/components/EventRow.tsx`
- `src/modules/forex-calendar/components/Filters.tsx`
- `src/modules/forex-calendar/components/TimezoneBar.tsx`
- `src/modules/forex-calendar/hooks/useCalendarData.ts`
- `src/modules/forex-calendar/hooks/useFilters.ts`
- `src/modules/forex-calendar/services/calendar.service.ts`
- `src/modules/forex-calendar/types/calendar.types.ts`
- `src/modules/forex-calendar/utils/date.utils.ts`
- `src/modules/forex-calendar/utils/format.utils.ts`
- `src/pages/ForexNews.tsx` (thin wrapper)

**Edited files:**
- `vite.config.ts` — add `/api/calendar` proxy to `https://nfs.faireconomy.media`
- `src/App.tsx` — register `/forex-news` route
- `src/components/layout/Sidebar.tsx` — add "Forex News Calendar" nav item with `Newspaper` icon directly above the Tools group (works in both expanded and collapsed states with tooltip)

## Behavior preserved

- Same ForexFactory weekly JSON feed
- Same auto-refresh interval (60s default)
- Same impact/currency filters
- Same date tab navigation
- Same timezone bar
- Same row formatting and visual styling

No logic changes — pure port + wiring.
