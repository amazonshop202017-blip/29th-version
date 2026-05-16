import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { muiTextFieldSx, muiPopperSx, muiDialogSx } from "./AppDateTimePicker";

/**
 * Time-only picker counterpart to AppDateTimePicker.
 * - `value` is `"HH:mm"` (24h) or empty string for null.
 * - Mobile renders clock dialog; desktop renders popover with digital clock.
 * - 1-minute precision.
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
      ampm={ampm ?? false}
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