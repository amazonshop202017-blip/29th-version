import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { muiTextFieldSx, muiPopperSx, muiDialogSx } from "./AppDateTimePicker";

/**
 * Drop-in replacement for `<input type="date">` and shadcn `Calendar mode="single"`.
 *
 * Two value modes:
 *  - String mode: `value` is `YYYY-MM-DD`; `onChange` emits same shape.
 *  - Date mode: `value` is `Date | undefined`; `onChange` emits same shape.
 *
 * Mode is selected via `valueType` prop. Defaults to "string".
 */
export interface AppDatePickerStringProps {
  valueType?: "string";
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export interface AppDatePickerDateProps {
  valueType: "date";
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export type AppDatePickerProps = AppDatePickerStringProps | AppDatePickerDateProps;

export const AppDatePicker: React.FC<AppDatePickerProps> = (props) => {
  const { className, disabled, placeholder } = props;

  const dayjsValue: Dayjs | null = React.useMemo(() => {
    if (props.valueType === "date") {
      return props.value ? dayjs(props.value) : null;
    }
    return props.value ? dayjs(props.value, "YYYY-MM-DD") : null;
  }, [props]);

  const handleChange = (d: Dayjs | null) => {
    if (props.valueType === "date") {
      if (!d || !d.isValid()) {
        props.onChange(undefined);
        return;
      }
      // Build a local-midnight Date so it matches shadcn Calendar's output.
      props.onChange(new Date(d.year(), d.month(), d.date(), 0, 0, 0, 0));
    } else {
      if (!d || !d.isValid()) {
        props.onChange("");
        return;
      }
      props.onChange(d.format("YYYY-MM-DD"));
    }
  };

  return (
    <DatePicker
      value={dayjsValue && dayjsValue.isValid() ? dayjsValue : null}
      onChange={handleChange}
      disabled={disabled}
      views={["year", "month", "day"]}
      slotProps={{
        textField: {
          fullWidth: true,
          size: "small",
          placeholder,
          className,
          sx: muiTextFieldSx,
        },
        popper: { sx: muiPopperSx },
        dialog: { sx: muiDialogSx },
      }}
    />
  );
};