## Goal
Make the MUI date/time picker resolve to 1-minute precision (currently defaults to 5-minute steps) everywhere it's used.

## Where it's used
All date+time inputs in the app go through a single shared wrapper: `src/components/ui/AppDateTimePicker.tsx`, which renders either `MobileDateTimePicker` or `DesktopDateTimePicker`. It is consumed by:
- `src/components/trades/TradeModal.tsx` (entry & exit datetime)
- `src/components/backtesting/AddTradeModal.tsx` (entry/exit datetime fields)
- `src/pages/backtesting/BacktestSession.tsx` (inline datetime field)

Because everything funnels through `AppDateTimePicker`, a single edit covers all call sites.

## Change
In `src/components/ui/AppDateTimePicker.tsx`, pass `timeSteps={{ minutes: 1 }}` to the rendered `Picker` (both `MobileDateTimePicker` and `DesktopDateTimePicker` accept it).

That's the entire change — no API surface or call-site updates needed.

## Out of scope
- The Duration (min/max) `TimePicker` inputs in `AdvancedDayTimeSection` (separate component, not part of this request — can be done in a follow-up if desired).
- Any visual/style changes.