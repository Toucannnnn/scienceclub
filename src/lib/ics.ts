/**
 * Minimal RFC 5545 calendar file writer. No dependency — one event is all
 * this app ever needs to emit.
 */

export type CalendarEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
};

/** RFC 5545 §3.3.5: UTC form, no punctuation. Emitting UTC rather than a
 * local time means no VTIMEZONE block, and every client reads it right. */
function toIcsUtc(date: Date) {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** Backslash, semicolon and comma are delimiters; newlines become \n. */
function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r?\n/g, "\\n");
}

/**
 * Lines must not exceed 75 octets. Continuations start with a single space.
 * Measured in octets, not characters — a multi-byte character split across
 * the boundary would corrupt the file.
 */
function foldLine(line: string) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    // 74 leaves room for the leading space on the continuation line.
    if (currentBytes + charBytes > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current) parts.push(current);

  return parts.map((part, i) => (i === 0 ? part : ` ${part}`)).join("\r\n");
}

export function buildIcs(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Science All Stars//Tutoring//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.description
      ? [`DESCRIPTION:${escapeText(event.description)}`]
      : []),
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // CRLF is mandatory, including a trailing one.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/**
 * An "Add to Google Calendar" URL. No OAuth — this just prefills Google's
 * event composer.
 *
 * Times go in UTC Z form and `ctz` is deliberately omitted: passing both
 * makes some clients apply the offset twice.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const dates = `${toIcsUtc(event.start)}/${toIcsUtc(event.end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
