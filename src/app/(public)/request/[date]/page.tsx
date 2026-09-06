import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDaysIcon, InfoIcon } from "lucide-react";
import { getProfileWithRoles } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCalendarDays, getCoursesForDate } from "@/lib/data/calendar-days";
import { clubToday, formatSessionDate, SESSION_TIME_LABEL } from "@/lib/format";
import { GuestRequestForm, MemberRequestForm } from "./request-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Request a session" };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** A card that explains why no form is shown, plus the way back. */
function Blocked({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/calendar" className={buttonVariants({ variant: "outline" })}>
          Pick another day
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function RequestSessionPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  // Guard before the date reaches Postgres — an unparseable date would come
  // back as a 500 rather than a 404.
  if (!YMD.test(date) || Number.isNaN(Date.parse(date))) notFound();

  const supabase = await createClient();
  const [dayInfo, courses, profile] = await Promise.all([
    getCalendarDays(supabase, date, date),
    getCoursesForDate(supabase, date),
    getProfileWithRoles(),
  ]);

  const day = dayInfo[date];
  const today = clubToday();
  const readableDate = formatSessionDate(date);

  if (date < today) {
    return (
      <div className="mx-auto max-w-xl">
        <Blocked title={`${readableDate} has already passed`}>
          You can only ask for a tutor on a day that hasn&apos;t happened yet.
        </Blocked>
      </div>
    );
  }

  if (!day?.isOpen || courses.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <Blocked title={`No tutoring on ${readableDate}`}>
          {day?.closureLabel
            ? `School is closed — ${day.closureLabel}.`
            : "Tutoring only runs on days a teacher is hosting a room."}
        </Blocked>
      </div>
    );
  }

  const isApprovedMember = profile?.status === "approved";

  // create_tutor_request_as_guest is granted to anon only, so a signed-in
  // account that isn't approved yet can use neither path — say so plainly
  // rather than handing them a form that fails on submit.
  if (profile && !isApprovedMember) {
    return (
      <div className="mx-auto max-w-xl">
        <Blocked title="Your account is still pending">
          An admin needs to approve it before you can request a tutor. You can
          log out and ask as a guest instead — that never needs an account.
        </Blocked>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Request a tutor for {readableDate}
        </h1>
        <p className="text-muted-foreground">
          {SESSION_TIME_LABEL} · hosted by {day.teacherNames.join(", ")}
        </p>
      </div>

      {/* The user's own wording: nobody should be left stranded because no
          tutor picked up their ticket. */}
      <div className="flex gap-2 rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        <p>
          Tutors approved for your course get emailed as soon as you send this,
          and we&apos;ll let you know if one claims it. Requests have to be in
          before <strong>12:00 PM</strong> on the day itself. Even if nobody
          claims it, you can still go straight to your teacher&apos;s room at
          12:15 — they&apos;re hosting either way.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your request</CardTitle>
          <CardDescription>
            {isApprovedMember
              ? `Asking as ${profile.fullName} — it'll show up under Tutee bookings.`
              : "No account needed — just tell us who you are and what you need."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isApprovedMember ? (
            <MemberRequestForm sessionDate={date} courses={courses} />
          ) : (
            <GuestRequestForm sessionDate={date} courses={courses} />
          )}
        </CardContent>
      </Card>

      <Link
        href="/calendar"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <CalendarDaysIcon className="size-4" /> Back to the calendar
      </Link>
    </div>
  );
}
