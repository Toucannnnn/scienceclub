import Link from "next/link";
import type { CalendarDayMap } from "@/lib/data/calendar-days";
import type { ParsedRequest, ParsedSlot } from "./types";
import { TODAY_PILL, slotLabel } from "./types";
import {
  addDays,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  toYmd,
} from "./date-utils";
import { DAY_LABELS, fullDayFormatter } from "./formatters";
import { RequestChips, RequestDayAction, canRequestOn } from "./day-requests";

// Tall enough for the date plus three chips and an overflow line. min-h,
// not a fixed height, so a busy day can grow instead of clipping.
const MONTH_MIN_ROW_HEIGHT = 112;
const CHIPS_PER_CELL = 3;
// Always 6 rows: max leading offset (6) + longest month (31) = 37 ≤ 42, so
// six rows always suffice, and a fixed count means no layout shift paging
// between months.
const MONTH_CELLS = 42;

export function MonthGrid({
  viewDate,
  slots,
  requests,
  dayInfo,
  now,
  onSelectDay,
}: {
  viewDate: Date;
  slots: ParsedSlot[];
  requests: ParsedRequest[];
  dayInfo: CalendarDayMap;
  now: Date;
  onSelectDay: (day: Date) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(viewDate));
  const cells = Array.from({ length: MONTH_CELLS }, (_, i) => addDays(gridStart, i));

  return (
    <>
      {/* Desktop: chips per day. */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <div className="grid grid-cols-7 border-b">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="border-l px-2 py-2 text-center text-xs text-muted-foreground first:border-l-0"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day) => {
            // Same day, same time — order by course so the chips read
            // consistently rather than by insertion order.
            const daySlots = slots
              .filter((slot) => isSameDay(slot.date, day))
              .sort((a, b) => slotLabel(a).localeCompare(slotLabel(b)));
            const dayRequests = requests.filter((r) => isSameDay(r.date, day));
            const visible = daySlots.slice(0, CHIPS_PER_CELL);
            const overflow = daySlots.length - visible.length;
            const inMonth = isSameMonth(day, viewDate);
            const isToday = isSameDay(day, now);
            const info = dayInfo[toYmd(day)];

            return (
              <div
                // Not a button/link: the chips inside are links and the date
                // is a button, and nesting interactive elements is invalid
                // HTML and breaks keyboard navigation.
                key={day.toISOString()}
                className={`flex flex-col gap-0.5 border-t border-l p-1 ${
                  inMonth ? "" : "bg-muted/30"
                }`}
                style={{ minHeight: MONTH_MIN_ROW_HEIGHT }}
              >
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  aria-label={`View ${fullDayFormatter.format(day)}`}
                  className="self-start rounded-full text-xs hover:underline"
                >
                  {isToday ? (
                    <span className={TODAY_PILL}>{day.getDate()}</span>
                  ) : (
                    <span
                      className={`px-1 ${inMonth ? "" : "text-muted-foreground"}`}
                    >
                      {day.getDate()}
                    </span>
                  )}
                </button>

                {visible.map((slot) => {
                  // Every session is at the same time now, so the time isn't
                  // worth the ~90px a month cell has — the course is.
                  const label = slot.isOwn
                    ? `${slotLabel(slot)} (yours)`
                    : slotLabel(slot);
                  return (
                    <Link
                      key={slot.id}
                      href={`/book/${slot.id}`}
                      title={`${label} — ${slot.tutor_name}, ${slot.location_name}`}
                      className="truncate rounded border border-primary/30 bg-accent px-1.5 py-0.5 text-[0.7rem] text-accent-foreground hover:shadow-sm"
                    >
                      {label}
                    </Link>
                  );
                })}

                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    aria-label={`Show all ${daySlots.length} slots on ${fullDayFormatter.format(day)}`}
                    className="px-1 text-left text-[0.7rem] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    +{overflow} more
                  </button>
                )}

                <RequestChips requests={dayRequests} compact />

                {/* Safe to nest a link here — the cell itself is a plain div
                    and only the date and "+N more" are buttons. */}
                <RequestDayAction day={day} now={now} dayInfo={info} compact />
              </div>
            );
          })}
        </div>
      </div>

      {/* Phone: a 7-column chip grid is unreadable, so show dots and let a tap
          open that day in the day view, the way iOS Calendar does. */}
      <div className="overflow-hidden rounded-2xl border bg-card md:hidden">
        <div className="grid grid-cols-7 border-b">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-2 text-center text-[0.7rem] text-muted-foreground"
            >
              {label.charAt(0)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const count = slots.filter((slot) => isSameDay(slot.date, day)).length;
            const inMonth = isSameMonth(day, viewDate);
            const isToday = isSameDay(day, now);
            // Can't nest the request link inside this button, so the cell just
            // signals that the day is open and routes into day view, which
            // carries the real button.
            const canRequest = canRequestOn(day, now, dayInfo[toYmd(day)]);

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelectDay(day)}
                aria-label={`${fullDayFormatter.format(day)}, ${count} open slot${count === 1 ? "" : "s"}${
                  canRequest ? ", open for requests" : ""
                }`}
                className={`flex h-14 flex-col items-center justify-center gap-1 border-t ${
                  canRequest && count === 0 ? "text-primary" : ""
                }`}
              >
                {isToday ? (
                  <span className={TODAY_PILL}>{day.getDate()}</span>
                ) : (
                  <span
                    className={`text-sm ${inMonth ? "" : "text-muted-foreground opacity-60"}`}
                  >
                    {day.getDate()}
                  </span>
                )}
                <span className="flex h-1 gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                    <span key={i} className="size-1 rounded-full bg-primary" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
