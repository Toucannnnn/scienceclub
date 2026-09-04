import Link from "next/link";
import type { ParsedSlot } from "./types";
import { TODAY_PILL } from "./types";
import { isSameDay, minutesInDay } from "./date-utils";
import { DAY_LABELS, hourFormatter, timeFormatter } from "./formatters";

export const HOUR_HEIGHT = 56; // px per hour, close to Google Calendar's density
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;
const MIN_BLOCK_HEIGHT = 28;

type PositionedSlot = {
  slot: ParsedSlot;
  column: number;
  columnCount: number;
};

/**
 * Lays out one day's slots into side-by-side columns so concurrent sessions
 * don't cover each other. Without this, two slots at the same time render
 * exactly on top of one another and the one underneath can't be clicked at
 * all — so this isn't polish, it's the difference between a bookable slot
 * and an invisible one.
 *
 * A plain function rather than a hook: React Compiler is enabled here and
 * hand-rolled memo deps over Date objects trip its lint rule.
 */
function packDaySlots(slots: ParsedSlot[]): PositionedSlot[] {
  const sorted = [...slots].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime()
  );

  const positioned: PositionedSlot[] = [];
  let cluster: ParsedSlot[] = [];
  let clusterEnd = 0;

  function flushCluster() {
    if (cluster.length === 0) return;
    // Greedy: drop each slot into the first column it fits after.
    const columns: ParsedSlot[][] = [];
    const columnOf = new Map<string, number>();

    for (const slot of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const last = columns[i][columns[i].length - 1];
        if (last.end.getTime() <= slot.start.getTime()) {
          columns[i].push(slot);
          columnOf.set(slot.id, i);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([slot]);
        columnOf.set(slot.id, columns.length - 1);
      }
    }

    for (const slot of cluster) {
      positioned.push({
        slot,
        column: columnOf.get(slot.id) ?? 0,
        columnCount: columns.length,
      });
    }
    cluster = [];
    clusterEnd = 0;
  }

  for (const slot of sorted) {
    if (cluster.length > 0 && slot.start.getTime() >= clusterEnd) flushCluster();
    cluster.push(slot);
    clusterEnd = Math.max(clusterEnd, slot.end.getTime());
  }
  flushCluster();

  return positioned;
}

/** The visible hour window, widened to fit whatever the range actually holds. */
function hourWindow(slots: ParsedSlot[]) {
  if (slots.length === 0) {
    // Without this guard the ±1 padding below is applied to the defaults
    // themselves, so an empty grid renders 7am–9pm instead of 8am–8pm.
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }
  const earliest = Math.min(...slots.map((s) => s.start.getHours()));
  const latest = Math.max(
    ...slots.map((s) => s.end.getHours() + (s.end.getMinutes() > 0 ? 1 : 0))
  );
  return {
    startHour: Math.max(0, Math.min(DEFAULT_START_HOUR, earliest - 1)),
    endHour: Math.min(24, Math.max(DEFAULT_END_HOUR, latest + 1)),
  };
}

export function TimeGrid({
  days,
  slots,
  now,
  variant,
}: {
  days: Date[];
  slots: ParsedSlot[];
  now: Date;
  variant: "day" | "week";
}) {
  const { startHour, endHour } = hourWindow(slots);
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i
  );
  const gridHeight = hours.length * HOUR_HEIGHT;
  const isDay = variant === "day";

  // Tailwind's JIT needs whole class strings, so these can't be built by
  // interpolating days.length.
  const columnsClass = isDay
    ? "grid-cols-[3.5rem_minmax(0,1fr)]"
    : "grid-cols-[3.5rem_repeat(7,1fr)]";

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className={`grid ${columnsClass} border-b bg-card`}>
        <div />
        {days.map((day) => {
          const isToday = isSameDay(day, now);
          return (
            <div key={day.toISOString()} className="border-l px-2 py-2 text-center">
              <p className="text-xs text-muted-foreground">
                {DAY_LABELS[day.getDay()]}
              </p>
              <p className={isToday ? `mx-auto mt-0.5 ${TODAY_PILL}` : "mt-0.5 text-sm font-medium"}>
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      <div className={`relative grid ${columnsClass}`}>
        <div className="relative" style={{ height: gridHeight }}>
          {hours.map((hour, i) => (
            <div
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[0.7rem] text-muted-foreground"
              style={{ top: i * HOUR_HEIGHT }}
            >
              {i === 0 ? "" : hourFormatter.format(new Date(2000, 0, 1, hour, 0))}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const daySlots = slots.filter((slot) => isSameDay(slot.start, day));
          const positioned = packDaySlots(daySlots);
          const showNowLine = isSameDay(day, now);
          const nowTop = ((minutesInDay(now) - startHour * 60) / 60) * HOUR_HEIGHT;

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

              {positioned.map(({ slot, column, columnCount }) => {
                const startMin = minutesInDay(slot.start);
                // Wall-clock minutes, not elapsed milliseconds: `top` is a
                // wall-clock coordinate, so on a DST day an elapsed-ms height
                // disagrees with the hour lines it's drawn against.
                const endMin = isSameDay(slot.start, slot.end)
                  ? minutesInDay(slot.end)
                  : 24 * 60;
                const top = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT;
                const rawHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                const height = Math.min(
                  Math.max(rawHeight, MIN_BLOCK_HEIGHT),
                  Math.max(gridHeight - top, MIN_BLOCK_HEIGHT)
                );
                const spotsLeft = slot.capacity - slot.reserved_count;
                const width = 100 / columnCount;

                return (
                  <Link
                    key={slot.id}
                    href={`/book/${slot.id}`}
                    className="absolute z-20 overflow-hidden rounded-lg border border-primary/30 bg-accent px-2 py-1 text-left text-accent-foreground transition-shadow hover:shadow-md"
                    style={{
                      top,
                      height,
                      left: `calc(${column * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                    }}
                  >
                    {isDay ? (
                      <>
                        <p className="truncate text-sm font-medium">
                          {timeFormatter.format(slot.start)} –{" "}
                          {timeFormatter.format(slot.end)}
                          {slot.subject_name ? ` · ${slot.subject_name}` : ""}
                        </p>
                        <p className="truncate text-xs opacity-80">
                          {slot.isOwn ? "Your slot" : slot.tutor_name}
                        </p>
                        {height > 64 && (
                          <p className="truncate text-xs opacity-70">
                            {slot.location_name}
                            {slot.max_capacity > 1
                              ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                              : ""}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
