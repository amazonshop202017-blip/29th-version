import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import { MobileDateTimePicker } from "@mui/x-date-pickers/MobileDateTimePicker";
import { DesktopDateTimePicker } from "@mui/x-date-pickers/DesktopDateTimePicker";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * MUI X Date Picker wrappers tuned to match this app's value/onChange shapes
 * and theme. Wrapped at the app root in <LocalizationProvider dateAdapter={AdapterDayjs}>.
 *
 * Behaviour mirrors the reference "Date Picker Duo" project:
 *  - DateTime: MobileDateTimePicker on phones, DesktopDateTimePicker on tablet/desktop.
 *  - Date only: standard DatePicker with year/month/day views.
 */

// Shared visual styling so MUI inputs align with our shadcn/Tailwind UI.
const fieldSx = {
  width: "100%",
  "& .MuiInputBase-root": {
    height: 40, // matches h-10
    fontSize: "0.875rem",
    backgroundColor: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
    borderRadius: "0.5rem",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "hsl(var(--border))",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "hsl(var(--border))",
  },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "hsl(var(--ring))",
    borderWidth: "1px",
  },
  "& .MuiSvgIcon-root": {
    color: "hsl(var(--muted-foreground))",
  },
  "& .MuiInputLabel-root": { display: "none" },
  "& legend": { display: "none" },
  "& fieldset": { top: 0 },
} as const;

/* ------------------------------------------------------------------ */
/*  AppDateTimePicker                                                  */
/* ------------------------------------------------------------------ */

export interface AppDateTimePickerProps {
  /** Value as `YYYY-MM-DDTHH:mm` naive local string (same as <input type="datetime-local">). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function dayjsToLocalInputString(d: Dayjs | null): string {
  if (!d || !d.isValid()) return "";
  return d.format("YYYY-MM-DDTHH:mm");
}

function localInputStringToDayjs(s: string): Dayjs | null {
  if (!s) return null;
  const d = dayjs(s);
  return d.isValid() ? d : null;
}

export function AppDateTimePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: AppDateTimePickerProps) {
  const isMobile = useIsMobile();
  const Picker = isMobile ? MobileDateTimePicker : DesktopDateTimePicker;

  const dayjsValue = React.useMemo(() => localInputStringToDayjs(value), [value]);

  return (
    <div className={className}>
      <Picker
        value={dayjsValue}
        onChange={(v) => onChange(dayjsToLocalInputString(v as Dayjs | null))}
        disabled={disabled}
        ampm={false}
        format="YYYY-MM-DD HH:mm"
        slotProps={{
          textField: {
            placeholder: placeholder ?? "YYYY-MM-DD HH:mm",
            size: "small",
            fullWidth: true,
            sx: fieldSx,
          },
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AppDatePicker — Date object value                                  */
/* ------------------------------------------------------------------ */

export interface AppDatePickerProps {
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AppDatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: AppDatePickerProps) {
  const dayjsValue = React.useMemo(
    () => (value ? dayjs(value) : null),
    [value],
  );

  return (
    <div className={className}>
      <DatePicker
        value={dayjsValue}
        onChange={(v) => {
          const d = v as Dayjs | null;
          onChange(d && d.isValid() ? d.toDate() : undefined);
        }}
        disabled={disabled}
        views={["year", "month", "day"]}
        format="YYYY-MM-DD"
        slotProps={{
          textField: {
            placeholder: placeholder ?? "YYYY-MM-DD",
            size: "small",
            fullWidth: true,
            sx: fieldSx,
          },
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AppDatePickerString — string YYYY-MM-DD value (for forms that      */
/*  store the raw input string, e.g. TrackAccountModal)                */
/* ------------------------------------------------------------------ */

export interface AppDatePickerStringProps {
  value: string; // YYYY-MM-DD or empty
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AppDatePickerString({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: AppDatePickerStringProps) {
  const dayjsValue = React.useMemo(() => {
    if (!value) return null;
    const d = dayjs(value);
    return d.isValid() ? d : null;
  }, [value]);

  return (
    <div className={className}>
      <DatePicker
        value={dayjsValue}
        onChange={(v) => {
          const d = v as Dayjs | null;
          onChange(d && d.isValid() ? d.format("YYYY-MM-DD") : "");
        }}
        disabled={disabled}
        views={["year", "month", "day"]}
        format="YYYY-MM-DD"
        slotProps={{
          textField: {
            placeholder: placeholder ?? "YYYY-MM-DD",
            size: "small",
            fullWidth: true,
            sx: fieldSx,
          },
        }}
      />
    </div>
  );
}