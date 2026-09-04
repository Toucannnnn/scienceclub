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

/** Minutes since local midnight. */
export function minutesInDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}
