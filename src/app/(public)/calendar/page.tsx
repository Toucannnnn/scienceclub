import Link from "next/link";
import { getProfileWithRoles } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPublicOpenSlots } from "@/lib/data/public-slots";
import { getPublicRequests } from "@/lib/data/requests";
import { getCalendarDays } from "@/lib/data/calendar-days";
import { clubToday } from "@/lib/format";
import { SlotCalendar } from "@/components/calendar/slot-calendar";

export const metadata = { title: "Calendar" };

// How far either side of today the calendar knows which days are open. Wide
// enough to page through a whole school year in either direction; every row
// repeats the same few teacher names, so the payload compresses to almost
// nothing. Past the window days simply read as closed, which is what an
// out-of-term date is anyway.
const DAYS_BEHIND = 60;
const DAYS_AHEAD = 400;

function shiftDate(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  const supabase = await createClient();
  const today = clubToday();

  // All public on purpose: anyone can see what's open, what's been asked for,
  // and which days tutoring runs. get_public_open_slots, get_public_requests
  // and get_calendar_days are each granted to anon as well as authenticated,
  // so this one set of calls serves signed-out visitors and members alike.
  const [slots, requests, dayInfo, profile] = await Promise.all([
    getPublicOpenSlots(supabase),
    getPublicRequests(supabase),
    getCalendarDays(
      supabase,
      shiftDate(today, -DAYS_BEHIND),
      shiftDate(today, DAYS_AHEAD)
    ),
    getProfileWithRoles(),
  ]);

  const calendarSlots = slots.map((slot) => ({
    ...slot,
    isOwn: slot.tutor_id === profile?.id,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">
          Every open tutoring session, and every tutee still waiting for a
          tutor. Click a session to book it
          {profile?.status === "approved"
            ? "."
            : " — no account needed, just your name and email."}{" "}
          Nothing on the day you need? Use{" "}
          <span className="font-medium text-foreground">Request a session</span>{" "}
          and we&apos;ll ask the tutors for you.
        </p>
      </div>

      {/* The calendar always renders, even with nothing posted — an empty grid
          you can page through is more useful (and less alarming) than a
          message where the calendar should be. */}
      <SlotCalendar
        slots={calendarSlots}
        requests={requests}
        dayInfo={dayInfo}
      />

      {slots.length === 0 && (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <p className="font-medium">No open sessions posted yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Request one on any day tutoring runs — or{" "}
            <Link href="/signup" className="underline underline-offset-4">
              sign up as a tutor
            </Link>{" "}
            and post the first one.
          </p>
        </div>
      )}
    </div>
  );
}
