"use client";

import * as React from "react";
import { DateTimePicker, DateTimePickerProps } from "./datetime-picker";

export type DateTimeInputProps = DateTimePickerProps;

export const DateTimeInput = React.forwardRef<HTMLInputElement, DateTimeInputProps>(
  (props, ref) => {
    return <DateTimePicker {...props} />;
  }
);

DateTimeInput.displayName = "DateTimeInput";

export { DateTimePicker };
