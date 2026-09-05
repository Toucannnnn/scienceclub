import type { CalendarView } from "./types";
import { addDays, startOfWeek } from "./date-utils";

// Module-level so the (relatively expensive) Intl objects are built once,
// not per render.
export const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** Sessions are always this half hour — a constant, not a computed range. */
export const SESSION_TIME_LABEL = "12:15 – 12:45 PM";

export const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const fullDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

export const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The toolbar's range label, e.g. "September 2026" or "Sep 1 – Sep 7, 2026". */
export function formatRangeLabel(view: CalendarView, viewDate: Date) {
  if (view === "month") return monthYearFormatter.format(viewDate);
  if (view === "day") {
    return `${fullDayFormatter.format(viewDate)}, ${viewDate.getFullYear()}`;
  }
  const weekStart = startOfWeek(viewDate);
  const weekEnd = addDays(weekStart, 6);
  return `${monthDayFormatter.format(weekStart)} – ${monthDayFormatter.format(
    weekEnd
  )}, ${weekEnd.getFullYear()}`;
}
