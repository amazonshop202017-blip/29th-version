import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";

/**
 * Time-only picker counterpart to AppDateTimePicker.
 * Uses the stock MUI v7 TimePicker popup (matches the
 * "Time Input Delight" reference project exactly).
 * - `value` is `"HH:mm"` (24h) or empty string for null.
 */
export interface AppTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  ampm?: boolean;
}

const formatTime = (d: Dayjs | null): string => {
  if (!d || !d.isValid()) return "";
  return d.format("HH:mm");
};

export const AppTimePicker: React.FC<AppTimePickerProps> = ({
  value,
  onChange,
  label,
  className,
  disabled,
  ampm,
}) => {
  const dayjsValue = value ? dayjs(`2000-01-01T${value}`) : null;

  return (
    <TimePicker
      label={label}
      value={dayjsValue && dayjsValue.isValid() ? dayjsValue : null}
      onChange={(d) => onChange(formatTime(d as Dayjs | null))}
      disabled={disabled}
      ampm={ampm ?? true}
      slotProps={{
        textField: {
          fullWidth: true,
          size: "small",
          label,
          className,
        },
        popper: {
          sx: {
            "& .MuiMultiSectionDigitalClockSection-root": {
              maxHeight: 216,
              scrollbarGutter: "stable",
              pr: 1,
              "&::after": { height: 0 },
            },
          },
        },
      }}
    />
  );
};