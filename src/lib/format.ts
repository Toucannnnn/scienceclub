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
