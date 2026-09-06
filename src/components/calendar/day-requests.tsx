import Link from "next/link";
import { HandIcon, PlusIcon } from "lucide-react";
import type { CalendarDay } from "@/lib/data/calendar-days";
import type { ParsedRequest } from "./types";
import { isSameDay, startOfDay, toYmd } from "./date-utils";

/** The hour after which a request for *that same day* is refused, mirroring
 * request_cutoff_at() in SQL — tutors need warning before 12:15. */
const REQUEST_CUTOFF_HOUR = 12;

/**
 * Whether a tutee can still post a request for `day`.
 *
 * Uses the viewer's local clock, same as every other date decision in the
 * calendar. That's an approximation of America/Chicago for anyone browsing
 * from another timezone, and it only affects whether a button is offered —
 * assert_request_allowed() re-checks in the club's own timezone and refuses
 * anything late, so the worst case is a button that leads to a clear error
 * rather than a request that shouldn't exist.
 */
export function canRequestOn(day: Date, now: Date, dayInfo?: CalendarDay) {
  if (!dayInfo?.isOpen) return false;
  if (day < startOfDay(now)) return false;
  if (isSameDay(day, now) && now.getHours() >= REQUEST_CUTOFF_HOUR) return false;
  return true;
}

/** Open tickets on a day, as chips. Not links: a request isn't something a
 * visitor acts on (tutors claim them from their own inbox), and in a month
 * cell a link here would nest inside the day button. */
export function RequestChips({
  requests,
  compact,
}: {
  requests: ParsedRequest[];
  compact: boolean;
}) {
  if (requests.length === 0) return null;

  return (
    <>
      {requests.map((request) => (
        <span
          key={request.id}
          title={`A tutee asked for ${request.course_name} help${
            request.teacher_name ? ` in ${request.teacher_name}'s room` : ""
          }${request.claimable ? "" : " — signup for this one has closed"}`}
          className={`flex items-center gap-1 truncate rounded border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-muted-foreground ${
            compact ? "text-[0.7rem]" : "text-xs"
          }`}
        >
          <HandIcon className="size-3 shrink-0" />
          <span className="truncate">
            {compact ? request.course_name : `Wanted: ${request.course_name}`}
          </span>
        </span>
      ))}
    </>
  );
}

/**
 * The per-day call to action. On a day tutoring runs, a link to the request
 * form; on a closed day, why it's closed. Rendered for every day in range,
 * with or without sessions on it — a day with nothing posted is exactly when
 * a tutee most needs to ask.
 */
export function RequestDayAction({
  day,
  now,
  dayInfo,
  compact,
}: {
  day: Date;
  now: Date;
  dayInfo?: CalendarDay;
  compact: boolean;
}) {
  if (canRequestOn(day, now, dayInfo)) {
    return (
      <Link
        href={`/request/${toYmd(day)}`}
        className={`mt-auto flex items-center justify-center gap-1 rounded border border-dashed border-primary/40 px-1.5 py-1 text-primary transition-colors hover:bg-accent ${
          compact ? "text-[0.7rem]" : "text-xs"
        }`}
      >
        <PlusIcon className="size-3 shrink-0" />
        {compact ? "Request" : "Request a session"}
      </Link>
    );
  }

  // Past days and weekends get nothing — a "closed" note on every Saturday is
  // noise. A named closure is worth showing: it answers "why is this week
  // empty?" before anyone has to ask.
  if (dayInfo?.closureLabel && day >= startOfDay(now)) {
    return (
      <p
        className={`mt-auto truncate px-1 text-center text-muted-foreground ${
          compact ? "text-[0.7rem]" : "text-xs"
        }`}
        title={dayInfo.closureLabel}
      >
        {dayInfo.closureLabel}
      </p>
    );
  }

  return null;
}
