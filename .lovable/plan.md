## Goal
Replace the date-only picker on the Backtesting Session page's entry/exit date fields with the same date-and-time picker used by the Add Trade popup (`AppDateTimePicker`), so backtest trades capture an exact entry/exit time identical to live trades.

## Scope
The `field.type === 'date'` branch is what renders the entry/exit date inputs inside the backtest trades table (and the matching add/edit modal). Two files render that branch:

1. `src/pages/backtesting/BacktestSession.tsx` (inline editable row cells)
2. `src/components/backtesting/AddTradeModal.tsx` (the add/edit trade modal opened from the session)

Both currently use `AppDatePicker` (date only). Both will be switched to `AppDateTimePicker` — the exact same component the live Add Trade popup (`src/components/trades/TradeModal.tsx`) uses for Entry Date / Exit Date.

## Changes

### `src/pages/backtesting/BacktestSession.tsx`
- Replace the `AppDatePicker` import with `AppDateTimePicker`.
- In the `field.type === 'date'` branch, render `<AppDateTimePicker value={...} onChange={...} />` (drop the `className` prop — `AppDateTimePicker` styles its own trigger to match the trade modal).

### `src/components/backtesting/AddTradeModal.tsx`
- Same swap: replace `AppDatePicker` import with `AppDateTimePicker`, and replace the picker in the `f.type === 'date'` branch.

## Out of scope
- No changes to the underlying field schema (`type: 'date'` stays as-is).
- No changes to how values are stored, parsed, or displayed elsewhere — `AppDateTimePicker` already emits/accepts the same ISO string format the existing date fields use.
- No styling changes beyond what the picker brings.
- No changes to the live trades `TradeModal` (already uses the target component).