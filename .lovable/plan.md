## Goal

Match the Time Input Delight reference exactly: use MUI X `TimePicker` (responsive — `DesktopTimePicker` on desktop, `MobileTimePicker` on mobile) for both Min and Max duration inputs. The picker shows HH:mm; we convert to total minutes for filtering.

## Behavior

- Two responsive TimePicker inputs labeled **Min** and **Max** in the Duration row of `AdvancedDayTimeSection`.
- Desktop (≥768px) → `DesktopTimePicker` (popover with draggable clock / fields).
- Mobile (<768px) → `MobileTimePicker` (full-screen clock dialog).
- Value stored as a `Dayjs` time; on change we compute `hours * 60 + minutes` and write to `durationMinutesMin` / `durationMinutesMax` in `GlobalFiltersContext` (already wired).
- Clearing a picker (null) sets the corresponding bound to `null`.
- Filtering logic in `TradesContext` stays unchanged — it already filters closed trades by `durationMinutes` inclusive of both bounds.

## Changes

### 1. `src/components/layout/AdvancedDayTimeSection.tsx`
- Remove the two MUI `TextField` number inputs in the Duration FilterRow.
- Add imports: `DesktopTimePicker`, `MobileTimePicker` from `@mui/x-date-pickers`, `LocalizationProvider`, `AdapterDayjs`, `dayjs`, and reuse `useIsMobile` from `@/hooks/use-mobile`.
- Render `<LocalizationProvider dateAdapter={AdapterDayjs}>` wrapping a flex row with two pickers (Min, Max).
- Pick component = `isMobile ? MobileTimePicker : DesktopTimePicker`.
- Each picker's `value` derived from current context number: `min == null ? null : dayjs().startOf('day').add(min, 'minute')`.
- `onChange` → if null, set null; else `(d.hour() * 60 + d.minute())`.
- Apply the same `muiTextFieldSx` / `muiPopperSx` / `muiDialogSx` styling used in `src/components/ui/AppDateTimePicker.tsx` so the picker matches the app theme.
- Use `ampm={false}` for clarity (24-hour HH:mm = duration).
- Pass `slotProps={{ textField: { size: 'small', label: 'Min'/'Max', sx: muiTextFieldSx }, popper: { sx: muiPopperSx }, dialog: { sx: muiDialogSx } }}`.

### 2. `package.json` (deps)
- Ensure `@mui/x-date-pickers` and `dayjs` are installed (already used by `AppDateTimePicker`, so likely present — verify, install only if missing).

## No changes needed

- `GlobalFiltersContext.tsx` (state already typed `number | null` = total minutes).
- `TradesContext.tsx` (filter already uses `durationMinutes` against min/max).
- `SelectedFiltersBar.tsx` (chip already shows `Duration: min–max min`; we can optionally format as `HH:mm`, but out of scope unless requested).

## Out of scope

- Changing the chip format in `SelectedFiltersBar`.
- Changing any other filter inputs.
- Adding a separate seconds field.
