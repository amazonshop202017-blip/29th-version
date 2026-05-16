## Goal

Add a new **Duration (in minutes)** filter at the top of the Day & Time section in the Advanced Filters panel. It uses MUI's `TextField` (number input) for Min and Max values — the same library (`@mui/material`) used in the [Time Input Delight](/projects/5a0a73cc-48c5-4a3e-ab86-0bcbf337e5b3) reference project. Trades whose duration (in minutes) falls outside `[min, max]` are filtered out.

## Behavior

- Checkbox-row pattern matching the existing Year/Month/Day/Hour rows in `AdvancedDayTimeSection`.
- When checked → expands to reveal two side-by-side MUI `TextField` inputs labeled **Min** and **Max** (`type="number"`, `inputProps={{ min: 0 }}`).
- When unchecked → filter cleared (min/max set to `null`) and inactive.
- Filtering rule (matches the user's example 2–10 → 1 out, 11 out, 3/8/9 in):
  - For each trade, compute `durationMinutes` from `calculateTradeMetrics(trade)` (already used elsewhere, e.g. `TradeDurationPerformanceChart`).
  - Only closed trades have a duration; if `min` is set, keep trades where `durationMinutes >= min`. If `max` is set, keep trades where `durationMinutes <= max`. Both inclusive.
  - If the filter is active but a trade has no duration (open position), it is excluded.

## Changes

### 1. `src/contexts/GlobalFiltersContext.tsx`
- Add state: `durationMinutesMin: number | null`, `durationMinutesMax: number | null` with setters.
- Include in context value + reset/clear-all handlers (mirroring `selectedHours`).

### 2. `src/hooks/useFilteredTrades.ts` (and/or `useAccountScopedFilteredTrades.ts` if that's where day/hour filtering lives)
- After computing `durationMinutes` via `calculateTradeMetrics`, apply min/max bounds when either is non-null.

### 3. `src/components/layout/AdvancedDayTimeSection.tsx`
- Install/use MUI: add `@mui/material`, `@emotion/react`, `@emotion/styled` to deps.
- Add a new `FilterRow` **at the top** of the list (before Year) labeled `Duration, minutes`.
- Body: two MUI `TextField` inputs in a flex row (`Min` / `Max`), sized `small`, `type="number"`. Wire to context setters with empty-string → `null` handling.
- `active` = `durationMinutesMin !== null || durationMinutesMax !== null`. Toggle off clears both.

### 4. `src/components/layout/SelectedFiltersBar.tsx` (if it surfaces other filters)
- Add a chip showing `Duration: {min ?? '–'}–{max ?? '–'} min` when active, removable.

## Technical notes

- MUI `TextField` inherits MUI's default theme styling (matches the reference project look). No global MUI ThemeProvider needs to be added; the component renders standalone fine. If we later want consistent theming we can wrap the panel in a `ThemeProvider`, but it isn't required for this scope.
- Dependencies to add via `bun add`: `@mui/material @emotion/react @emotion/styled`. (`dayjs` and `@mui/x-date-pickers` are not needed — numeric inputs only.)
- No backend or schema changes.

## Out of scope

- Changing existing Year/Month/Day/Hour/Holding-Period filter visuals.
- Replacing other inputs in the panel with MUI.
- Adding a duration-unit toggle (seconds/hours) — strictly minutes per the request.
