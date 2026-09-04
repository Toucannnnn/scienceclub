import Link from "next/link";
import { MapPinIcon } from "lucide-react";
import type { ParsedSlot } from "./types";
import { fullDayFormatter, timeFormatter } from "./formatters";
import { isSameDay } from "./date-utils";

/** The phone view for ranges wider than a day — a 7-column grid is unusable
 * at that width, so week view falls back to a flat list. */
export function AgendaList({
  slots,
  emptyLabel,
  showDayHeadings,
}: {
  slots: ParsedSlot[];
  emptyLabel: string;
  showDayHeadings: boolean;
}) {
  if (slots.length === 0) {
    return (
      <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((slot, i) => {
        const spotsLeft = slot.capacity - slot.reserved_count;
        const startsNewDay =
          showDayHeadings && (i === 0 || !isSameDay(sorted[i - 1].start, slot.start));

        return (
          <div key={slot.id} className="flex flex-col gap-2">
            {startsNewDay && (
              <p className="px-1 text-xs font-medium text-muted-foreground">
                {fullDayFormatter.format(slot.start)}
              </p>
            )}
            <Link
              href={`/book/${slot.id}`}
              className="rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <p className="font-medium">
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
          </div>
        );
      })}
    </div>
  );
}
