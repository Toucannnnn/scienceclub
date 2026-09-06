import Link from "next/link";
import { MapPinIcon } from "lucide-react";
import type { CalendarDayMap } from "@/lib/data/calendar-days";
import type { ParsedRequest, ParsedSlot } from "./types";
import { fullDayFormatter, SESSION_TIME_LABEL } from "./formatters";
import { isSameDay, toYmd } from "./date-utils";
import { RequestChips, RequestDayAction, canRequestOn } from "./day-requests";

/**
 * The phone view for ranges wider than a day — a 7-column grid is unusable
 * at that width, so week view falls back to a flat list.
 *
 * Iterates `days` rather than slots so a day with nothing on it can still
 * offer a request button. Days that are closed *and* empty are skipped
 * entirely, which keeps a normal week down to the four days tutoring runs.
 */
export function AgendaList({
  days,
  slots,
  requests,
  dayInfo,
  now,
  emptyLabel,
}: {
  days: Date[];
  slots: ParsedSlot[];
  requests: ParsedRequest[];
  dayInfo: CalendarDayMap;
  now: Date;
  emptyLabel: string;
}) {
  const entries = days
    .map((day) => {
      const info = dayInfo[toYmd(day)];
      return {
        day,
        info,
        daySlots: slots.filter((slot) => isSameDay(slot.date, day)),
        dayRequests: requests.filter((r) => isSameDay(r.date, day)),
        canRequest: canRequestOn(day, now, info),
      };
    })
    .filter(
      (entry) =>
        entry.daySlots.length > 0 ||
        entry.dayRequests.length > 0 ||
        entry.canRequest
    );

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {entries.map(({ day, info, daySlots, dayRequests }) => (
        <div key={day.toISOString()} className="flex flex-col gap-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">
            {fullDayFormatter.format(day)}
          </p>

          {daySlots.map((slot) => {
            const spotsLeft = slot.capacity - slot.reserved_count;
            return (
              <Link
                key={slot.id}
                href={`/book/${slot.id}`}
                className="rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <p className="font-medium">{SESSION_TIME_LABEL}</p>
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

          <div className="flex flex-col gap-1.5">
            <RequestChips requests={dayRequests} compact={false} />
            <RequestDayAction
              day={day}
              now={now}
              dayInfo={info}
              compact={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
