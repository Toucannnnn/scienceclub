// Every step here goes through setDate/setMonth rather than arithmetic on
// epoch milliseconds. A day is not always 86,400,000 ms — on a DST boundary
// it's 23 or 25 hours — so `date.getTime() + n * 864e5` silently lands on
// the wrong day twice a year.

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Sunday-first, matching Google Calendar's US default. */
export function startOfWeek(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function startOfMonth(date: Date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Clamps to the last day of the target month, so Jan 31 + 1 month is
 * Feb 28 rather than rolling over into March. Note this means repeated
 * stepping can drift (Jan 31 → Feb 28 → Mar 28), which is what Google
 * Calendar does too. */
export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  // Move off the 31st before changing month, or setMonth itself overflows.
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTarget));
  return d;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Parses a YYYY-MM-DD session date as **local midnight**.
 *
 * `new Date("2026-09-09")` is parsed as UTC midnight, which in Central time
 * is the evening of Sep 8 — so every session would render one day early.
 * Every date-only string in the calendar must come through here.
 */
export function parseSessionDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * The inverse of parseSessionDate: a Date back to YYYY-MM-DD in *local* time.
 *
 * `toISOString().slice(0, 10)` is the trap here — it converts to UTC first,
 * so any time before 6pm Central reports the wrong day. Used to look a day up
 * in the calendar-day map and to build /request/[date] links.
 */
export function toYmd(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
