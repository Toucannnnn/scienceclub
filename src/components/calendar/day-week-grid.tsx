import type { ParsedSlot } from "./types";
import { TODAY_PILL } from "./types";
import { isSameDay } from "./date-utils";
import { DAY_LABELS, SESSION_TIME_LABEL } from "./formatters";
import { SessionCard } from "./session-card";

/**
 * Day and week views. Replaces the old hour-by-hour time grid: every session
 * is the same half hour, so an hour axis was 11½ empty hours framing one thin
 * band.
 *
 * Cells are flow layout with no fixed height, so a column grows with what's
 * in it — that's the "expands and contracts" behaviour across day/week/month.
 */
export function DayWeekGrid({
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
  const isDay = variant === "day";
  // Tailwind's JIT needs whole class strings — these can't be interpolated
  // from days.length.
  const columnsClass = isDay ? "grid-cols-1" : "grid-cols-7";

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className={`grid ${columnsClass} border-b`}>
        {days.map((day) => {
          const isToday = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className="border-l px-2 py-2 text-center first:border-l-0"
            >
              <p className="text-xs text-muted-foreground">
                {DAY_LABELS[day.getDay()]}
              </p>
              <p
                className={
                  isToday ? `mx-auto mt-0.5 ${TODAY_PILL}` : "mt-0.5 text-sm font-medium"
                }
              >
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      <div className={`grid ${columnsClass}`}>
        {days.map((day) => {
          const daySlots = slots.filter((slot) => isSameDay(slot.date, day));
          return (
            <div
              key={day.toISOString()}
              className="flex min-h-32 flex-col gap-1.5 border-l p-1.5 first:border-l-0"
            >
              {daySlots.length === 0 ? (
                <p className="px-1 py-2 text-center text-[0.7rem] text-muted-foreground">
                  {isDay ? "Nothing posted for this day." : ""}
                </p>
              ) : (
                <>
                  {isDay && (
                    <p className="px-1 text-xs text-muted-foreground">
                      {SESSION_TIME_LABEL}
                    </p>
                  )}
                  {daySlots.map((slot) => (
                    <SessionCard key={slot.id} slot={slot} detail={isDay} />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
