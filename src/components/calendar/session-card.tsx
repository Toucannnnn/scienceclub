import Link from "next/link";
import { MapPinIcon, UserIcon, UsersIcon } from "lucide-react";
import type { ParsedSlot } from "./types";
import { slotLabel, spotsLeft } from "./types";
import { SESSION_TIME_LABEL } from "./formatters";

/**
 * One bookable session. `detail` grows the card for day view, where there's
 * a full column's width to use; week cells get the compact form.
 *
 * Nothing here is absolutely positioned — cards stack in normal flow, so a
 * day with four sessions is simply taller than a day with one. That is the
 * expand/contract behaviour, and it's why the hour grid could go away.
 */
export function SessionCard({
  slot,
  detail = false,
}: {
  slot: ParsedSlot;
  detail?: boolean;
}) {
  const left = spotsLeft(slot);

  return (
    <Link
      href={`/book/${slot.id}`}
      className="block rounded-lg border border-primary/30 bg-accent px-2 py-1.5 text-accent-foreground transition-shadow hover:shadow-md"
    >
      <p className={detail ? "font-medium" : "truncate text-[0.75rem] font-medium"}>
        {slotLabel(slot)}
      </p>
      <p
        className={
          detail
            ? "mt-0.5 flex items-center gap-1.5 text-sm opacity-80"
            : "truncate text-[0.7rem] opacity-80"
        }
      >
        {detail && <UserIcon className="size-3.5" />}
        {slot.isOwn ? "Your session" : slot.tutor_name}
      </p>

      {detail && (
        <>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm opacity-80">
            <MapPinIcon className="size-3.5" />
            {slot.location_name} · {SESSION_TIME_LABEL}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm opacity-80">
            <UsersIcon className="size-3.5" />
            {slot.help_mode === "individual" ? "One-on-one" : "Group"}
            {left === null
              ? " · open to everyone"
              : ` · ${left} spot${left === 1 ? "" : "s"} left`}
          </p>
          {slot.notes && <p className="mt-1 text-sm opacity-70">{slot.notes}</p>}
        </>
      )}

      {!detail && left !== null && (
        <p className="truncate text-[0.7rem] opacity-70">
          {left} spot{left === 1 ? "" : "s"} left
        </p>
      )}
      {!detail && left === null && (
        <p className="truncate text-[0.7rem] opacity-70">Open to everyone</p>
      )}
    </Link>
  );
}
