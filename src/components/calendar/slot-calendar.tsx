"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarSlot, CalendarView, ParsedSlot } from "./types";
import {
  addDays,
  addMonths,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "./date-utils";
import { formatRangeLabel } from "./formatters";
import { parseSessionDate } from "./date-utils";
import { DayWeekGrid } from "./day-week-grid";
import { MonthGrid } from "./month-grid";
import { AgendaList } from "./agenda-list";

export type { CalendarSlot } from "./types";

const VIEWS: CalendarView[] = ["day", "week", "month"];

// The clock as an external store. Every date decision here depends on the
// viewer's timezone, which the server can't know — so the server snapshot is
// 0 ("no time yet", render a skeleton) and only the client reports a real
// minute. useSyncExternalStore is the hydration-safe way to do that: no
// effect, no setState-during-mount, no server/client mismatch.
function subscribeToMinute(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function getMinuteSnapshot() {
  // Must be stable within the same minute, or React re-renders in a loop.
  return Math.floor(Date.now() / 60_000);
}

function getServerMinuteSnapshot() {
  return 0;
}

export function SlotCalendar({ slots }: { slots: CalendarSlot[] }) {
  const minute = useSyncExternalStore(
    subscribeToMinute,
    getMinuteSnapshot,
    getServerMinuteSnapshot
  );
  const [view, setView] = useState<CalendarView>("week");
  // null means "follow today". It has to be null rather than a Date because
  // the initial value is computed during render, where reading the clock is
  // both impure (lint) and wrong (server timezone). A bonus: a tab left open
  // past midnight rolls forward on its own.
  const [anchor, setAnchor] = useState<Date | null>(null);

  const now = minute === 0 ? null : new Date(minute * 60_000);

  if (!now) {
    return (
      <div
        className="animate-pulse rounded-2xl border bg-card"
        style={{ height: 420 }}
        aria-label="Loading calendar"
      />
    );
  }

  const viewDate = anchor ?? startOfDay(now);

  // Two ranges, because in month view they differ: the *logical* range is the
  // calendar month (what the label says and the count counts), the *render*
  // range is the 42-day grid, which bleeds into adjacent months. Conflating
  // them makes "N open slots this month" quietly include next month.
  let logicalStart: Date;
  let logicalEnd: Date;
  let renderStart: Date;
  let renderEnd: Date;

  if (view === "day") {
    logicalStart = startOfDay(viewDate);
    logicalEnd = addDays(logicalStart, 1);
    renderStart = logicalStart;
    renderEnd = logicalEnd;
  } else if (view === "week") {
    logicalStart = startOfWeek(viewDate);
    logicalEnd = addDays(logicalStart, 7);
    renderStart = logicalStart;
    renderEnd = logicalEnd;
  } else {
    logicalStart = startOfMonth(viewDate);
    logicalEnd = addMonths(logicalStart, 1);
    renderStart = startOfWeek(logicalStart);
    renderEnd = addDays(renderStart, 42);
  }

  const parsedSlots: ParsedSlot[] = slots.map((slot) => ({
    ...slot,
    // parseSessionDate, never `new Date(ymd)` — the latter is UTC midnight,
    // which in Central is the evening before, shifting every session a day.
    date: parseSessionDate(slot.session_date),
  }));

  const renderSlots = parsedSlots.filter(
    (slot) => slot.date >= renderStart && slot.date < renderEnd
  );
  const logicalCount = parsedSlots.filter(
    (slot) => slot.date >= logicalStart && slot.date < logicalEnd
  ).length;

  // Based on the logical range, so viewing October's grid while today (Sep 29)
  // shows in a leading cell still leaves "Today" enabled.
  const isViewingToday = now >= logicalStart && now < logicalEnd;

  function step(direction: 1 | -1) {
    setAnchor(
      view === "day"
        ? addDays(viewDate, direction)
        : view === "week"
          ? addDays(viewDate, direction * 7)
          : addMonths(viewDate, direction)
    );
  }

  function openDay(day: Date) {
    setAnchor(day);
    setView("day");
  }

  const days =
    view === "day"
      ? [logicalStart]
      : Array.from({ length: 7 }, (_, i) => addDays(logicalStart, i));

  const countLabel =
    logicalCount === 0
      ? `No open slots this ${view}`
      : `${logicalCount} open slot${logicalCount === 1 ? "" : "s"} this ${view}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={isViewingToday}
            onClick={() => setAnchor(null)}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Previous ${view}`}
            onClick={() => step(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Next ${view}`}
            onClick={() => step(1)}
          >
            <ChevronRightIcon />
          </Button>
          <p className="ml-2 text-sm font-medium">
            {formatRangeLabel(view, viewDate)}
          </p>
        </div>

        <div
          role="group"
          aria-label="Calendar view"
          className="inline-flex rounded-full border border-border/60 bg-card p-0.5"
        >
          {VIEWS.map((option) => (
            <Button
              key={option}
              size="sm"
              // The selected look comes from the variant, not a CSS selector:
              // buttonVariants styles aria-expanded, not aria-pressed.
              variant={view === option ? "secondary" : "ghost"}
              aria-pressed={view === option}
              className="rounded-full capitalize"
              onClick={() => setView(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{countLabel}</p>

      {view === "month" ? (
        <MonthGrid
          viewDate={viewDate}
          slots={renderSlots}
          now={now}
          onSelectDay={openDay}
        />
      ) : (
        <>
          {/* Day view's single column is legible on a phone, so it renders the
              real grid there; week view falls back to the agenda list. */}
          <div className={view === "day" ? "block" : "hidden md:block"}>
            <DayWeekGrid days={days} slots={renderSlots} now={now} variant={view} />
          </div>
          {view === "week" && (
            <div className="md:hidden">
              <AgendaList
                slots={renderSlots}
                emptyLabel="No open slots this week."
                showDayHeadings
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
