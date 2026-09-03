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

/** Value usable in a <input type="datetime-local"> that round-trips through
 * `new Date(...)` — local time, no timezone suffix. */
export function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
