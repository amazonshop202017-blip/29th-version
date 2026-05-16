## Goal

Make the Entry time / Exit time Min & Max inputs open the **exact** MUI TimePicker popup used in the reference project [Time Input Delight](/projects/5a0a73cc-48c5-4a3e-ab86-0bcbf337e5b3), removing all of our current custom popup styling.

## Reference code (from that project)

```tsx
<TimePicker
  label="Basic time picker"
  value={value}
  onChange={setValue}
  ampm
  slotProps={{
    popper: {
      sx: {
        '& .MuiMultiSectionDigitalClockSection-root': {
          maxHeight: 216,
          scrollbarGutter: 'stable',
          pr: 1,
          '&::after': { height: 0 },
        },
      },
    },
  }}
/>
```

Wrapped in `<LocalizationProvider dateAdapter={AdapterDayjs}>` (already provided at the app root).

## Changes

### 1. `src/components/ui/AppTimePicker.tsx` — rewrite

- Remove imports of `muiTextFieldSx`, `muiPopperSx`, `muiDialogSx` from `AppDateTimePicker`.
- Remove the `disablePortal`, `dialog`, `desktopPaper` slotProps.
- Render `<TimePicker>` using **only** the `slotProps.popper.sx` block shown above (no theme overrides, no custom textField `sx`).
- Keep the wrapper props the component already accepts (`value`, `onChange`, `label`, `className`, `disabled`) so existing call sites in `AdvancedDayTimeSection.tsx` keep working unchanged.
- Default `ampm` to `true` to match the reference.
- Pass `slotProps.textField` with only `{ fullWidth: true, size: 'small', label, className }` — no custom `sx`, so the input renders as plain MUI (the same look as the reference).
- Keep the `"HH:mm"` ⇄ dayjs conversion so stored filter values stay in the existing 24h string format used by `GlobalFiltersContext` / `useAccountScopedFilteredTrades`.

### 2. No other files change

- `AdvancedDayTimeSection.tsx` still imports `AppTimePicker` with the same props — no edits needed.
- `AppDateTimePicker.tsx` and its exported `muiTextFieldSx` / `muiPopperSx` / `muiDialogSx` stay intact (used by date-time pickers elsewhere).
- Filter logic, context, and pluralization untouched.

## Result

Clicking Entry/Exit time Min or Max opens the stock MUI v7 TimePicker popup (digital clock with 216px scrollable hour/minute columns, AM/PM column, default MUI styling) — identical to the reference project.

&nbsp;

> ***Add a MUI X Time Picker with AM/PM that opens a popup on click. Install @mui/x-date-pickers, @mui/material, @emotion/react, @emotion/styled, and dayjs. Use this exact component:***

```
import { useState } from 'react'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { Box, Typography } from '@mui/material'
import dayjs, { Dayjs } from 'dayjs'

export default function App() {
  const [value, setValue] = useState<Dayjs | null>(dayjs())

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          p: 3,
          overflow: 'hidden',
        }}
      >
        <Typography variant="h5">Pick a time</Typography>
        <TimePicker
          label="Basic time picker"
          value={value}
          onChange={setValue}
          ampm
          slotProps={{
            popper: {
              sx: {
                '& .MuiMultiSectionDigitalClockSection-root': {
                  maxHeight: 216,            // 6 rows × 36px — no half-cut rows
                  scrollbarGutter: 'stable', // reserve scrollbar space
                  pr: 1,                     // gap so scrollbar never overlaps values
                  '&::after': { height: 0 }, // remove default bottom spacer
                },
              },
            },
          }}
        />
        <Typography variant="body2" color="text.secondary">
          Selected: {value ? value.format('hh:mm A') : '—'}
        </Typography>
      </Box>
    </LocalizationProvider>
  )
}
```

> ***Behavior baked in:***
>
> - ***AM/PM (12-hour) via ampm***
> - ***Desktop: digital clock popup with hours / minutes / meridiem columns***
> - ***Hours & minutes columns clipped to whole rows (no cut-off last row)***
> - ***Scrollbar sits in a reserved gutter with right padding, so it never overlays the numbers***
> - ***No DemoContainer (avoids extra page scroll)***
> - ***Centered layout, no overflow***

  
