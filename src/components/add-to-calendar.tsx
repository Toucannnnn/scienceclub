import { CalendarPlusIcon, DownloadIcon } from "lucide-react";
import { googleCalendarUrl } from "@/lib/ics";
import { buttonVariants } from "@/components/ui/button";

/**
 * "Add to Google Calendar" plus a .ics download, which covers Apple
 * Calendar, Outlook and everything else. No OAuth involved — the Google
 * link just prefills their event composer.
 *
 * A server component: both links are plain URLs, so there's no reason to
 * ship JavaScript for this.
 */
export function AddToCalendar({
  startsAt,
  endsAt,
  tutorName,
  courseName,
  locationName,
  slotId,
  reservationId,
  guestToken,
}: {
  startsAt: string;
  endsAt: string;
  tutorName: string;
  courseName?: string | null;
  locationName?: string | null;
  /** Signed-in members download by slot; guests download by reservation
   * plus their manage token. */
  slotId?: string;
  reservationId?: string;
  guestToken?: string;
}) {
  const summary = courseName
    ? `${courseName} tutoring with ${tutorName}`
    : `Tutoring with ${tutorName}`;

  const googleUrl = googleCalendarUrl({
    uid: slotId ?? reservationId ?? "",
    start: new Date(startsAt),
    end: new Date(endsAt),
    summary,
    description: "Science All Stars peer tutoring session.",
    location: locationName ?? undefined,
  });

  const icsHref =
    reservationId && guestToken
      ? `/api/calendar/ics?reservation=${reservationId}&t=${guestToken}`
      : `/api/calendar/ics?slot=${slotId}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <CalendarPlusIcon />
        Google Calendar
      </a>
      <a
        href={icsHref}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <DownloadIcon />
        .ics file
      </a>
    </div>
  );
}
