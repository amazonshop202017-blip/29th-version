# Migrate date / datetime inputs to MUI X Date Pickers

Goal: replace the current `<input type="date">`, `<input type="datetime-local">`, and shadcn `Calendar`+`Popover` pickers with MUI X pickers — exactly mirroring the reference project "Date Picker Duo". All surrounding logic (state shape, validation, save handlers, ISO conversion, defaults, edit-mode prefill) stays the same.

## Library choice (mirrors reference project)

- `@mui/material@^9`
- `@mui/x-date-pickers@^9`
- `@emotion/react@^11`, `@emotion/styled@^11`
- `dayjs@^1.11`

Wrap pickers in `<LocalizationProvider dateAdapter={AdapterDayjs}>`.

## Responsive datetime behavior (per reference)

```ts
const isMobile = useIsMobile(); // existing hook
const ResponsiveDateTimePicker = isMobile ? MobileDateTimePicker : DesktopDateTimePicker;
```

For date-only fields, use the single `DatePicker` component (it already adapts internally — same approach as reference `Index.tsx`).

## Shared wrapper components (new)

To avoid repeating the responsive switch and theming in every modal, add two thin wrappers:

- `src/components/ui/AppDateTimePicker.tsx`
  - Props: `value: string` (ISO or `YYYY-MM-DDTHH:mm`), `onChange: (iso: string) => void`, `label?`, `disabled?`, `className?`
  - Internally converts string ↔ `Dayjs`. On change, emits the same naive `YYYY-MM-DDTHH:mm` string the existing `<input type="datetime-local">` produced (so downstream `toISO()` calls keep working unchanged).
  - Renders `MobileDateTimePicker` on mobile, `DesktopDateTimePicker` otherwise.
- `src/components/ui/AppDatePicker.tsx`
  - Props: `value: string` (`YYYY-MM-DD`) **or** `Date | undefined`, `onChange`, `label?`, `placeholder?`.
  - Two value modes (matching the two existing patterns in the codebase):
    1. String mode → emits `YYYY-MM-DD` (drop-in for `<input type="date">`)
    2. Date mode → emits `Date | undefined` (drop-in for shadcn `Calendar mode="single"`)
  - Uses `DatePicker` with `views={["year","month","day"]}` like the reference.

Single mount of `LocalizationProvider` at the app root (in `src/App.tsx`) so every picker has the dayjs adapter without per-modal boilerplate.

## Styling

MUI components ship Material styling out of the box. To keep the existing Tailwind/shadcn look:

- Apply a small `sx` preset inside the wrappers so the input height matches `h-10`/`h-11`, border uses `hsl(var(--border))`, background uses `hsl(var(--background))`, text uses `hsl(var(--foreground))`. This is purely cosmetic — behavior is unchanged.
- Trigger button keeps the existing `CalendarDays`/`CalendarIcon` adornment via MUI `InputAdornment` where the current UI shows one.

No global MUI theme is required for behavior; styling tweaks live inside the two wrappers only.

## Files to change

Datetime (date + time) — swap `<input type="datetime-local">` for `AppDateTimePicker`:
1. `src/components/trades/TradeModal.tsx` — entry datetime (line ~939) and exit datetime (line ~1156). Keep `entryDate`/`exitDate` as `YYYY-MM-DDTHH:mm` strings; `toISO()` calls in submit stay untouched.
2. `src/components/trades/ScaleInOutModal.tsx` — note: actual per-leg datetime inputs live in TradeModal's scale rows (verified by grep). If/when scale-leg rows expose datetime, replace with `AppDateTimePicker` using the same string contract. (No change needed if file has no datetime input — confirmed during exploration.)

Date only — swap shadcn `Calendar`+`Popover` or `<input type="date">` for `AppDatePicker`:
3. `src/components/diary/SelectDayModal.tsx` — replace `Popover`+`Calendar` with `AppDatePicker` in Date mode. `onConfirm(format(d,'yyyy-MM-dd'))` logic preserved.
4. `src/components/propfirm/TrackAccountModal.tsx` — replace `<input type="date">` (line ~574) with `AppDatePicker` in String mode. `setStartDate` still receives `YYYY-MM-DD`.
5. `src/components/propfirm/AddEditTransactionModal.tsx` — replace `Calendar` (line ~220) with `AppDatePicker` in Date mode (state is `Date | undefined`).
6. `src/components/propfirm/PayoutModal.tsx` — replace `Popover`+`Calendar` with `AppDatePicker` in Date mode. `toISO(date)` on save unchanged.
7. `src/components/reports/CompareGroupCard.tsx` — replace the two `Popover`+`Calendar` blocks (start ~line 268, end ~line 296) with two `AppDatePicker`s in Date mode. `onFiltersChange({...filters, startDate / endDate })` keeps the same `Date | undefined` shape.

App-level:
8. `src/App.tsx` — wrap the existing tree in `<LocalizationProvider dateAdapter={AdapterDayjs}>` once.
9. `package.json` — add `@mui/material`, `@mui/x-date-pickers`, `@emotion/react`, `@emotion/styled`, `dayjs`.

## What stays exactly the same

- All state variables, their types, and update handlers.
- Validation (`valid`, disabled CTA, required-field markers).
- `toISO()` / `isoToDateInputValue()` / `isoToDateTimeLocalInputValue()` usage — wrappers emit the exact string/Date shapes those helpers already accept.
- Default values (`new Date()`, `nowISO()`), edit-mode prefill, reset on open/close.
- Save / submit logic and downstream context calls (`addTransaction`, `updateTrade`, `onConfirm`, `onFiltersChange`, etc.).
- Date-range filter in `GlobalHeader` and `DateRangeCalendar` — untouched (per your scope).
- Day View / calendar bubbles — untouched.

## QA checklist after implementation

For each of the 7 surfaces above, on desktop and mobile (≤768 px):
- Open modal → picker shows current value (or default).
- Pick a new date/time → state updates; CTA enables when valid.
- Save → record in context has identical ISO string as before migration.
- Edit existing record → picker pre-fills with the right local time.
- Mobile viewport renders the full-screen `MobileDateTimePicker` for datetime fields (matching reference behavior).

## Out of scope

- `GlobalHeader` date range, `DayView` calendar, `YearlyCalendar`, `MonthlyPerformanceCalendar`, dashboard calendar bubbles.
- Any visual redesign beyond matching current heights/colors.
- Migration of stored data — storage format is unchanged.
