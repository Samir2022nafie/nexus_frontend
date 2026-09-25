"use client";

import * as React from "react";
import { format, parseISO, isValid, addHours } from "date-fns";
import { Calendar as CalendarIcon, Clock, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export interface DateTimePickerProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dateOnly?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseValueToDate(val?: string, dateOnly: boolean = false): Date {
  if (!val) {
    return new Date();
  }
  try {
    if (val.length === 10) {
      // YYYY-MM-DD
      const [y, m, d] = val.split("-").map(Number);
      return new Date(y, m - 1, d, 12, 0);
    }
    const parsed = parseISO(val);
    if (isValid(parsed)) return parsed;
    const direct = new Date(val);
    if (isValid(direct)) return direct;
  } catch {
    // fallback
  }
  return new Date();
}

export function DateTimePicker({
  id,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  className,
  dateOnly = false,
  minDate,
  maxDate,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Stored working date during popover open
  const initialDate = React.useMemo(() => {
    return value ? parseValueToDate(value, dateOnly) : null;
  }, [value, dateOnly]);

  const [workingDate, setWorkingDate] = React.useState<Date>(
    initialDate || new Date()
  );

  const [viewYear, setViewYear] = React.useState<number>(
    (initialDate || new Date()).getFullYear()
  );
  const [viewMonth, setViewMonth] = React.useState<number>(
    (initialDate || new Date()).getMonth()
  );

  // Sync working date when popover opens or value changes
  React.useEffect(() => {
    if (open) {
      const d = value ? parseValueToDate(value, dateOnly) : new Date();
      setWorkingDate(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open, value, dateOnly]);

  // Year range calculation
  const currentYear = new Date().getFullYear();
  const startYear = dateOnly ? 1920 : currentYear - 5;
  const endYear = dateOnly ? currentYear - 13 : currentYear + 10;
  const years = React.useMemo(() => {
    const list: number[] = [];
    for (let y = endYear; y >= startYear; y--) {
      list.push(y);
    }
    return list;
  }, [startYear, endYear]);

  // Calendar days grid calculation
  const calendarDays = React.useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: { day: number; currentMonth: boolean; date: Date }[] = [];

    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({
        day: d,
        currentMonth: false,
        date: new Date(viewYear, viewMonth - 1, d),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        currentMonth: true,
        date: new Date(viewYear, viewMonth, d),
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        currentMonth: false,
        date: new Date(viewYear, viewMonth + 1, d),
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Time handling
  const hours24 = workingDate.getHours();
  const minutes = workingDate.getMinutes();
  const isPM = hours24 >= 12;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  const handleSelectDay = (dayDate: Date) => {
    const next = new Date(workingDate);
    next.setFullYear(dayDate.getFullYear());
    next.setMonth(dayDate.getMonth());
    next.setDate(dayDate.getDate());
    setWorkingDate(next);
    setViewYear(dayDate.getFullYear());
    setViewMonth(dayDate.getMonth());
  };

  const handleSetHour = (h12: number) => {
    const next = new Date(workingDate);
    const new24 = isPM ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
    next.setHours(new24);
    setWorkingDate(next);
  };

  const handleSetMinute = (m: number) => {
    const next = new Date(workingDate);
    next.setMinutes(m);
    setWorkingDate(next);
  };

  const handleToggleAmPm = (toPM: boolean) => {
    const next = new Date(workingDate);
    const currentH12 = hours12;
    const new24 = toPM ? (currentH12 === 12 ? 12 : currentH12 + 12) : currentH12 === 12 ? 0 : currentH12;
    next.setHours(new24);
    setWorkingDate(next);
  };

  const handlePresetNow = () => {
    const now = new Date();
    setWorkingDate(now);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const handlePresetOffsetHours = (offset: number) => {
    const next = addHours(new Date(), offset);
    setWorkingDate(next);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  // Done button handler inside the selector
  const handleDone = () => {
    const formatted = dateOnly
      ? format(workingDate, "yyyy-MM-dd")
      : format(workingDate, "yyyy-MM-dd'T'HH:mm");
    onChange?.(formatted);
    setOpen(false);
  };

  // Display text in trigger input
  const displayText = React.useMemo(() => {
    if (!value) return null;
    try {
      const d = parseValueToDate(value, dateOnly);
      if (isValid(d)) {
        return dateOnly
          ? format(d, "MMM d, yyyy")
          : format(d, "MMM d, yyyy · h:mm a");
      }
    } catch {
      // fallback
    }
    return value;
  }, [value, dateOnly]);

  return (
    <div className="relative w-full">
      {name ? <input type="hidden" name={name} value={value || ""} /> : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          onBlur={onBlur}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs sm:text-sm font-normal transition-colors outline-none cursor-pointer",
            "hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            !displayText && "text-muted-foreground",
            displayText && "text-foreground font-medium",
            "dark:bg-zinc-900/90 dark:border-zinc-700",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {dateOnly ? (
              <CalendarIcon className="size-3.5 text-primary shrink-0" />
            ) : (
              <Clock className="size-3.5 text-primary shrink-0" />
            )}
            <span className="truncate">
              {displayText || placeholder || (dateOnly ? "Select date" : "Select date and time")}
            </span>
          </div>

          <span className="text-[10px] uppercase font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded ml-2 shrink-0">
            {displayText ? "Change" : "Pick"}
          </span>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[310px] sm:w-[340px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl space-y-3 z-50"
        >
          {/* Header Summary */}
          <div className="flex items-center justify-between border-b border-border/60 pb-2 px-0.5">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                {dateOnly ? "Date of Birth Selector" : "Date & Time Selector"}
              </span>
              <span className="text-xs font-medium text-foreground truncate max-w-[240px]">
                {dateOnly
                  ? format(workingDate, "EEEE, MMMM d, yyyy")
                  : format(workingDate, "EEE, MMM d, yyyy · h:mm a")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Month & Year Navigation Row */}
          <div className="flex items-center justify-between gap-1.5 px-0.5">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear(viewYear - 1);
                } else {
                  setViewMonth(viewMonth - 1);
                }
              }}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Selector */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="h-7 text-xs font-medium rounded-md border border-border/80 bg-background px-2 py-0.5 text-foreground outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="h-7 text-xs font-medium rounded-md border border-border/80 bg-background px-2 py-0.5 text-foreground outline-none cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear(viewYear + 1);
                } else {
                  setViewMonth(viewMonth + 1);
                }
              }}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Days Grid */}
          <div className="space-y-1">
            <div className="grid grid-cols-7 text-center">
              {DAYS_OF_WEEK.map((d) => (
                <span key={d} className="text-[11px] font-semibold text-muted-foreground py-0.5">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarDays.map((item, idx) => {
                const isSelected =
                  workingDate.getFullYear() === item.date.getFullYear() &&
                  workingDate.getMonth() === item.date.getMonth() &&
                  workingDate.getDate() === item.date.getDate();

                const isToday =
                  new Date().getFullYear() === item.date.getFullYear() &&
                  new Date().getMonth() === item.date.getMonth() &&
                  new Date().getDate() === item.date.getDate();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(item.date)}
                    className={cn(
                      "h-7 w-full rounded-md text-xs font-medium transition-all flex items-center justify-center",
                      item.currentMonth ? "text-foreground" : "text-muted-foreground/40",
                      isSelected && "bg-primary text-primary-foreground font-bold shadow-xs hover:bg-primary/90",
                      !isSelected && isToday && "border border-primary/50 font-semibold text-primary",
                      !isSelected && item.currentMonth && "hover:bg-muted"
                    )}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Picker Section (for datetime fields only) */}
          {!dateOnly && (
            <div className="border-t border-border/60 pt-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3 text-primary" /> Time
                </span>

                {/* Quick Presets */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePresetNow}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded transition-colors"
                  >
                    Now
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetOffsetHours(1)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded transition-colors"
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetOffsetHours(7)}
                    className="text-[10px] font-medium text-primary font-semibold bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded transition-colors"
                  >
                    +7h
                  </button>
                </div>
              </div>

              {/* Time Pickers (Hours, Minutes, AM/PM) */}
              <div className="flex items-center justify-center gap-1.5 bg-muted/30 p-1.5 rounded-lg border border-border/40">
                {/* Hour */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase">H:</span>
                  <select
                    value={hours12}
                    onChange={(e) => handleSetHour(Number(e.target.value))}
                    className="h-7 text-xs font-semibold rounded-md border border-border bg-background px-2 text-foreground outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-muted-foreground font-bold">:</span>

                {/* Minute */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase">M:</span>
                  <select
                    value={minutes}
                    onChange={(e) => handleSetMinute(Number(e.target.value))}
                    className="h-7 text-xs font-semibold rounded-md border border-border bg-background px-2 text-foreground outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AM / PM Toggle */}
                <div className="flex rounded-md border border-border overflow-hidden ml-1">
                  <button
                    type="button"
                    onClick={() => handleToggleAmPm(false)}
                    className={cn(
                      "px-2 py-1 text-[11px] font-semibold transition-colors",
                      !isPM ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAmPm(true)}
                    className={cn(
                      "px-2 py-1 text-[11px] font-semibold transition-colors border-l border-border",
                      isPM ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Bar INSIDE the Selector with the Requested DONE Button */}
          <div className="border-t border-border/60 pt-2.5 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDone}
              className="h-8 px-4 gap-1.5 bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:bg-primary/90 transition-all active:scale-95"
            >
              <Check className="size-3.5" />
              <span>Done</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
