# Plan: Entry time & Exit time interval filters

Add two new rows under the existing **Hour** filter in the advanced Day & Time section: **Entry time** and **Exit time**. Each supports multiple Min→Max intervals (Add +/remove) and uses the same MUI TimePicker we already use elsewhere (via `AppTimePicker` / `AppDateTimePicker` styling — responsive: desktop popper, mobile clock, `timeSteps={{ minutes: 1 }}`).

## UX (matches reference image)

- Checkbox row labeled "Entry time" / "Exit time" (same `FilterRow` pattern).
- When expanded, shows one or more interval rows of `[ Min ] [ Max ]`.
- Below the last interval: **Add +** button to append another interval.
- Each additional interval has a small remove (−) button on the right (first interval has none, matching the screenshot).
- Inputs use the MUI TimePicker (responsive: desktop draggable, mobile clock), 1-minute precision, `HH:mm` format.

## Filter semantics

- **Entry time intervals**: a trade passes if its entry datetime's time-of-day falls inside ANY one of the intervals (OR across intervals).
- **Exit time intervals**: same logic but on the trade's exit/close datetime.
- Intervals where Min or Max is empty are ignored. Min > Max is treated as wrap-around midnight (e.g. 22:00 → 02:00).
- Combines with all other filters via AND (same as existing filters).

## Files to change

### 1. `src/contexts/GlobalFiltersContext.tsx`
Add new state + setters (interval = `{ min: string | null; max: string | null }`, time as `"HH:mm"`):
- `entryTimeIntervals: TimeInterval[]` + `setEntryTimeIntervals`
- `exitTimeIntervals: TimeInterval[]` + `setExitTimeIntervals`
- Export `TimeInterval` type.
- Default `[]` (no filter).

### 2. `src/components/layout/AdvancedDayTimeSection.tsx`
- New `FilterRow`s "Entry time" and "Exit time" inserted directly under the existing Hour row.
- New local `TimeIntervalList` subcomponent rendering the Min/Max MUI TimePickers, Add +, and remove buttons.
- Active when intervals array has at least one entry with both min and max set.
- Use the existing shared picker wrapper (same one with `timeSteps={{ minutes:1 }}`, responsive desktop/mobile) — extend it with a time-only variant if needed (`AppTimePicker`) reusing the same `LocalizationProvider`/`AdapterDayjs` config.

### 3. `src/hooks/useAccountScopedFilteredTrades.ts` (and the sibling unscoped `useFilteredTrades` reducer if any)
- Pull `entryTimeIntervals`, `exitTimeIntervals` from `useGlobalFilters()`.
- After existing Hour filter block, add:
  - Entry time: compute trade entry's `minutesOfDay`, accept if any interval matches (handle wrap-around).
  - Exit time: same on `closeDate`.
- Add both arrays to the `useMemo` deps.

### 4. `src/components/layout/SelectedFiltersBar.tsx` (display chip)
- Show a chip like "Entry time: 09:30–11:00, 14:00–15:30" when any complete intervals exist; same for Exit time. Clicking the chip clears that filter.

## Out of scope
- No changes to backtesting trade synthesis logic.
- No changes to the existing Duration / Hour / Day filters.
- No new persistence (matches behavior of other Day & Time filters which are session-only).
