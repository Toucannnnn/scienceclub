const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** "Tue, Sep 3 · 3:00 – 4:00 PM" */
export function formatSlotTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}

/** Is this timestamp still in the future? Reads the clock, so it lives here
 * rather than in a component body — same reason as getDefaultSlotWindow
 * below: the "components must be pure" lint rule flags impure calls inside
 * anything it recognizes as a component. */
export function isUpcoming(isoString: string) {
  return new Date(isoString).getTime() > Date.now();
}

/** Sort comparator for anything with a `starts_at`, soonest first. */
export function byStartsAtAsc(
  a: { starts_at: string },
  b: { starts_at: string }
) {
  return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
}

/** Sessions are always this half hour, so it's a constant, not a format. */
export const SESSION_TIME_LABEL = "12:15 – 12:45 PM";

/** Today's date in the club's timezone as YYYY-MM-DD, for date input `min`.
 * Reads the clock, so it lives here rather than in a component body — the
 * "components must be pure" lint rule flags impure calls inside anything it
 * recognizes as a component. */
export function clubToday() {
  // en-CA gives ISO-shaped YYYY-MM-DD, which is what <input type="date"> wants.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
  }).format(new Date());
}

/** Parses a YYYY-MM-DD session date as *local midnight*. `new Date("2026-09-09")`
 * parses as UTC midnight, which in Central is the evening of Sep 8 — every
 * session would render a day early. Always use this for date-only strings. */
export function parseSessionDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** A sensible starting point for a new slot's start/end time — an hour from
 * now, one hour long. Kept out of any component body: reading the current
 * time is impure, and the "components must be pure" lint rule flags that
 * inside anything it recognizes as a component (PascalCase function). */
export function getDefaultSlotWindow() {
  const start = new Date(Date.now() + 60 * 60 * 1000); // +1h
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h more
  return { start, end };
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

/** "3h ago" / "in 2 days" — coarse relative time for notification lists. */
export function formatRelativeTime(isoString: string) {
  const diffMs = new Date(isoString).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 24 * 365],
    ["month", 60 * 24 * 30],
    ["week", 60 * 24 * 7],
    ["day", 60 * 24],
    ["hour", 60],
    ["minute", 1],
  ];

  for (const [unit, minutesPerUnit] of units) {
    if (Math.abs(diffMinutes) >= minutesPerUnit || unit === "minute") {
      return relativeTimeFormatter.format(
        Math.round(diffMinutes / minutesPerUnit),
        unit
      );
    }
  }
  return relativeTimeFormatter.format(0, "minute");
}

/** Value usable in a <input type="datetime-local"> that round-trips through
 * `new Date(...)` — local time, no timezone suffix. */
export function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
