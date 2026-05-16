import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import { MobileDateTimePicker } from "@mui/x-date-pickers/MobileDateTimePicker";
import { DesktopDateTimePicker } from "@mui/x-date-pickers/DesktopDateTimePicker";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Drop-in replacement for `<input type="datetime-local">`.
 *
 * - `value` is a naive `YYYY-MM-DDTHH:mm` string (same shape produced by
 *   `isoToDateTimeLocalInputValue`). Empty string → null picker.
 * - `onChange` always receives the same `YYYY-MM-DDTHH:mm` shape so any
 *   downstream `toISO()` call keeps working unchanged.
 * - On mobile (≤768px) renders MUI `MobileDateTimePicker` (full-screen drawer).
 *   On desktop renders `DesktopDateTimePicker` (popover).
 */
export interface AppDateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  ampm?: boolean;
}

const formatNaive = (d: Dayjs | null): string => {
  if (!d || !d.isValid()) return "";
  return d.format("YYYY-MM-DDTHH:mm");
};

export const AppDateTimePicker: React.FC<AppDateTimePickerProps> = ({
  value,
  onChange,
  className,
  disabled,
  ampm,
}) => {
  const isMobile = useIsMobile();
  const Picker = isMobile ? MobileDateTimePicker : DesktopDateTimePicker;
  const dayjsValue = value ? dayjs(value) : null;

  return (
    <Picker
      value={dayjsValue && dayjsValue.isValid() ? dayjsValue : null}
      onChange={(d) => onChange(formatNaive(d as Dayjs | null))}
      disabled={disabled}
      ampm={ampm}
      timeSteps={{ minutes: 1 }}
      slotProps={{
        textField: {
          fullWidth: true,
          size: "small",
          className,
          sx: muiTextFieldSx,
        },
        popper: { sx: muiPopperSx, disablePortal: true },
        dialog: { sx: muiDialogSx },
        desktopPaper: { sx: { pointerEvents: "auto" } },
      }}
    />
  );
};

export const muiTextFieldSx = {
  "& .MuiOutlinedInput-root": {
    height: 40,
    borderRadius: "0.375rem",
    backgroundColor: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    "& fieldset": { borderColor: "hsl(var(--border))" },
    "&:hover fieldset": { borderColor: "hsl(var(--border))" },
    "&.Mui-focused fieldset": { borderColor: "hsl(var(--ring))", borderWidth: "2px" },
  },
  "& .MuiInputBase-input": { color: "hsl(var(--foreground))", padding: "8px 12px" },
  "& .MuiSvgIcon-root": { color: "hsl(var(--muted-foreground))" },
} as const;

export const muiPopperSx = {
  zIndex: 9999,
  "& .MuiPaper-root": {
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    border: "1px solid hsl(var(--border))",
  },
  "& .MuiPickersDay-root": {
    color: "hsl(var(--foreground))",
    "&:hover": { backgroundColor: "hsl(var(--accent))" },
    "&.Mui-selected": {
      backgroundColor: "hsl(var(--primary))",
      color: "hsl(var(--primary-foreground))",
      "&:hover": { backgroundColor: "hsl(var(--primary))" },
    },
  },
  "& .MuiPickersCalendarHeader-label, & .MuiDayCalendar-weekDayLabel, & .MuiPickersYear-yearButton, & .MuiPickersMonth-monthButton, & .MuiClock-pin, & .MuiClockPointer-root, & .MuiClockNumber-root": {
    color: "hsl(var(--foreground))",
  },
  "& .MuiClock-clock": { backgroundColor: "hsl(var(--muted))" },
  "& .MuiClockPointer-root, & .MuiClock-pin, & .MuiClockPointer-thumb": {
    backgroundColor: "hsl(var(--primary))",
    borderColor: "hsl(var(--primary))",
  },
  "& .MuiButtonBase-root": { color: "hsl(var(--foreground))" },
  "& .MuiMultiSectionDigitalClockSection-root": {
    padding: 0,
    width: "auto",
    minWidth: 56,
    scrollbarWidth: "thin",
  },
  "& .MuiMultiSectionDigitalClockSection-item": {
    margin: "2px 4px",
    padding: "4px 10px",
    minWidth: "auto",
  },
  "& .MuiMultiSectionDigitalClock-root": { padding: 0 },
} as const;

export const muiDialogSx = {
  zIndex: 9999,
  "& .MuiDialog-paper": {
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
  },
  "& .MuiPickersToolbar-root, & .MuiPickersLayout-toolbar": {
    color: "hsl(var(--foreground))",
  },
  "& .MuiPickersDay-root": {
    color: "hsl(var(--foreground))",
    "&.Mui-selected": {
      backgroundColor: "hsl(var(--primary))",
      color: "hsl(var(--primary-foreground))",
    },
  },
  "& .MuiButton-root": { color: "hsl(var(--primary))" },
  "& .MuiClock-clock": { backgroundColor: "hsl(var(--muted))" },
  "& .MuiClockPointer-root, & .MuiClock-pin, & .MuiClockPointer-thumb": {
    backgroundColor: "hsl(var(--primary))",
    borderColor: "hsl(var(--primary))",
  },
} as const;