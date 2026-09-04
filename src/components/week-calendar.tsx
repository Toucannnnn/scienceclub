"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalendarSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  max_capacity: number;
  reserved_count: number;
  tutor_name: string;
  subject_name: string | null;
  location_name: string;
  notes: string | null;
  isOwn: boolean;
};

const HOUR_HEIGHT = 56; // px per hour, close to Google Calendar's density
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const hourFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric" });
const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const fullDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday-first, like Google Calendar
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Minutes since local midnight. */
function minutesInDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

// The clock as an external store. Every date decision below depends on the
// viewer's timezone, which the server can't know — so the server snapshot
// is 0 ("no time yet", render a skeleton) and only the client ever reports
// a real minute. useSyncExternalStore is the hydration-safe way to do that:
// no effect, no setState-during-mount, and no server/client mismatch.
function subscribeToMinute(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function getMinuteSnapshot() {
  // Must be stable between calls within the same minute, or React re-renders
  // in a loop.
  return Math.floor(Date.now() / 60_000);
}

function getServerMinuteSnapshot() {
  return 0;
}

export function WeekCalendar({ slots }: { slots: CalendarSlot[] }) {
  const minute = useSyncExternalStore(
    subscribeToMinute,
    getMinuteSnapshot,
    getServerMinuteSnapshot
  );
  // Which week is on screen is tracked as an offset from "this week", so
  // the current time stays the single source of truth for dates.
  const [weekOffset, setWeekOffset] = useState(0);

  const now = minute === 0 ? null : new Date(minute * 60_000);
  const weekStart = now ? addDays(startOfWeek(now), weekOffset * 7) : null;

  // No useMemo anywhere below: React Compiler is on for this project and
  // memoizes automatically, and hand-rolled deps on Date objects defeat its
  // analysis ("existing memoization could not be preserved").
  const parsedSlots = slots.map((slot) => ({
    ...slot,
    start: new Date(slot.starts_at),
    end: new Date(slot.ends_at),
  }));

  const days = weekStart
    ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    : [];

  const weekEnd = weekStart ? addDays(weekStart, 7) : null;
  const weekSlots =
    weekStart && weekEnd
      ? parsedSlots.filter(
          (slot) => slot.start >= weekStart && slot.start < weekEnd
        )
      : [];

  // Widen the visible hour window to whatever the week's slots actually need.
  const earliest =
    weekSlots.length > 0
      ? Math.min(...weekSlots.map((s) => s.start.getHours()))
      : DEFAULT_START_HOUR;
  const latest =
    weekSlots.length > 0
      ? Math.max(
          ...weekSlots.map(
            (s) => s.end.getHours() + (s.end.getMinutes() > 0 ? 1 : 0)
          )
        )
      : DEFAULT_END_HOUR;
  const startHour = Math.max(0, Math.min(DEFAULT_START_HOUR, earliest - 1));
  const endHour = Math.min(24, Math.max(DEFAULT_END_HOUR, latest + 1));

  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i
  );
  const gridHeight = hours.length * HOUR_HEIGHT;

  if (!weekStart) {
    return (
      <div
        className="animate-pulse rounded-2xl border bg-card"
        style={{ height: 12 * HOUR_HEIGHT }}
        aria-label="Loading calendar"
      />
    );
  }

  const weekLabel = `${monthDayFormatter.format(days[0])} – ${monthDayFormatter.format(
    days[6]
  )}, ${days[6].getFullYear()}`;

  const upcomingThisWeek = [...weekSlots].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => setWeekOffset((offset) => offset - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => setWeekOffset((offset) => offset + 1)}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-1"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset(0)}
          >
            Today
          </Button>
        </div>
        <p className="text-sm font-medium">{weekLabel}</p>
        <p className="text-sm text-muted-foreground">
          {weekSlots.length} open slot{weekSlots.length === 1 ? "" : "s"} this week
        </p>
      </div>

      {/* Week grid — the desktop view. */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b bg-card">
          <div />
          {days.map((day) => {
            const isToday = now ? isSameDay(day, now) : false;
            return (
              <div
                key={day.toISOString()}
                className="border-l px-2 py-2 text-center"
              >
                <p className="text-xs text-muted-foreground">
                  {DAY_LABELS[day.getDay()]}
                </p>
                <p
                  className={
                    isToday
                      ? "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
                      : "mt-0.5 text-sm font-medium"
                  }
                >
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        <div className="relative grid grid-cols-[3.5rem_repeat(7,1fr)]">
          {/* Hour gutter */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[0.7rem] text-muted-foreground"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {i === 0
                  ? ""
                  : hourFormatter.format(new Date(2000, 0, 1, hour, 0))}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayStart = new Date(day);
            dayStart.setHours(startHour, 0, 0, 0);
            const daySlots = weekSlots.filter((slot) =>
              isSameDay(slot.start, day)
            );
            const showNowLine = now ? isSameDay(day, now) : false;
            const nowTop =
              now && showNowLine
                ? ((minutesInDay(now) - startHour * 60) / 60) * HOUR_HEIGHT
                : 0;

            return (
              <div
                key={day.toISOString()}
                className="relative border-l"
                style={{ height: gridHeight }}
              >
                {hours.map((hour, i) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                ))}

                {showNowLine && nowTop >= 0 && nowTop <= gridHeight && (
                  <div
                    className="absolute inset-x-0 z-10 border-t-2 border-destructive"
                    style={{ top: nowTop }}
                    aria-hidden
                  />
                )}

                {daySlots.map((slot) => {
                  const top =
                    ((minutesInDay(slot.start) - startHour * 60) / 60) * HOUR_HEIGHT;
                  const rawHeight =
                    ((slot.end.getTime() - slot.start.getTime()) / 3_600_000) *
                    HOUR_HEIGHT;
                  const height = Math.max(rawHeight, 28);
                  const spotsLeft = slot.capacity - slot.reserved_count;

                  return (
                    <Link
                      key={slot.id}
                      href={`/book/${slot.id}`}
                      className="absolute inset-x-1 z-20 overflow-hidden rounded-lg border border-primary/30 bg-accent px-2 py-1 text-left text-accent-foreground transition-shadow hover:shadow-md"
                      style={{ top, height }}
                    >
                      <p className="truncate text-[0.7rem] font-medium">
                        {timeFormatter.format(slot.start)}
                        {slot.subject_name ? ` · ${slot.subject_name}` : ""}
                      </p>
                      <p className="truncate text-[0.7rem] opacity-80">
                        {slot.isOwn ? "Your slot" : slot.tutor_name}
                      </p>
                      {height > 52 && (
                        <p className="truncate text-[0.65rem] opacity-70">
                          {slot.max_capacity > 1
                            ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                            : slot.location_name}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda view — the phone view, where a 7-column grid is unusable. */}
      <div className="flex flex-col gap-3 md:hidden">
        {upcomingThisWeek.length === 0 && (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No open slots this week.
          </p>
        )}
        {upcomingThisWeek.map((slot) => {
          const spotsLeft = slot.capacity - slot.reserved_count;
          return (
            <Link
              key={slot.id}
              href={`/book/${slot.id}`}
              className="rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <p className="text-xs text-muted-foreground">
                {fullDayFormatter.format(slot.start)}
              </p>
              <p className="mt-0.5 font-medium">
                {timeFormatter.format(slot.start)} – {timeFormatter.format(slot.end)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {slot.isOwn ? "Your slot" : slot.tutor_name}
                {slot.subject_name ? ` · ${slot.subject_name}` : ""}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPinIcon className="size-3" />
                {slot.location_name}
                {slot.max_capacity > 1
                  ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                  : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
