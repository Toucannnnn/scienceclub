import Link from "next/link";
import { getProfileWithRoles } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPublicOpenSlots } from "@/lib/data/public-slots";
import { SlotCalendar } from "@/components/calendar/slot-calendar";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const supabase = await createClient();
  // Public on purpose: anyone can see what's open. get_public_open_slots is
  // granted to both anon and authenticated (0007), so this one call serves
  // signed-out visitors and members alike. Note it only returns slots that
  // haven't started yet, so past days always render empty.
  const [slots, profile] = await Promise.all([
    getPublicOpenSlots(supabase),
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
          Every open tutoring slot. Click one to book it
          {profile?.status === "approved"
            ? "."
            : " — no account needed, just your name and email."}
        </p>
      </div>

      {/* The calendar always renders, even with nothing posted — an empty
          grid you can page through is more useful (and less alarming) than a
          message where the calendar should be. */}
      <SlotCalendar slots={calendarSlots} />

      {slots.length === 0 && (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <p className="font-medium">No open slots posted yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back soon — or{" "}
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
