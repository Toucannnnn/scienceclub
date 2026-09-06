import Link from "next/link";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getSlotAttendees, type SlotAttendee } from "@/lib/data/slots";
import { getApprovedCourseNames } from "@/lib/data/courses";
import { getTutorSessions, type TutorSession } from "@/lib/data/hours";
import { clubToday, formatSessionDate, SESSION_TIME_LABEL } from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { ProofUpload } from "@/components/proof-upload";
import { cancelSlotAction } from "@/app/actions/slots";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Tutor availability" };

const HOURS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  submitted: { label: "Hours pending review", variant: "secondary" },
  approved: { label: "Hours approved", variant: "default" },
  rejected: { label: "Hours sent back", variant: "outline" },
};

export default async function AvailabilityPage() {
  const profile = await requireApprovedProfile();

  if (!hasRole(profile, "tutor")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tutor availability</CardTitle>
          <CardDescription>
            Only tutors can post availability slots. Ask an admin if you think
            you should have the tutor role.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createClient();
  const today = clubToday();
  const [sessions, approvedCourses] = await Promise.all([
    getTutorSessions(supabase, profile.id),
    getApprovedCourseNames(supabase, profile.id),
  ]);

  // Who's actually coming, for sessions that have someone booked.
  const attendeesBySlot = new Map<string, SlotAttendee[]>();
  await Promise.all(
    sessions
      .filter((s) => s.reservedCount > 0)
      .map(async (s) => {
        const attendees = await getSlotAttendees(supabase, s.id);
        attendeesBySlot.set(
          s.id,
          attendees.filter((a) => a.status === "booked")
        );
      })
  );

  // Comparing YYYY-MM-DD strings is safe and avoids a timezone round trip.
  const past = sessions.filter((s) => s.sessionDate < today);
  const todays = sessions.filter((s) => s.sessionDate === today);
  const upcoming = sessions
    .filter((s) => s.sessionDate > today)
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tutor availability
          </h1>
          <p className="text-muted-foreground">
            {approvedCourses.length === 0
              ? "You're not approved for any courses yet — request approval before posting sessions."
              : `You're approved to tutor: ${approvedCourses.join(", ")}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/hours" className={buttonVariants({ variant: "outline" })}>
            My hours
          </Link>
          <Link
            href="/tutor/courses"
            className={buttonVariants({ variant: "outline" })}
          >
            My courses
          </Link>
          <Link href="/availability/new" className={buttonVariants()}>
            Post a session
          </Link>
        </div>
      </div>

      <SessionGroup
        title="Today"
        description="Once 12:15 comes round, submit a photo as proof so your hours count."
        sessions={todays}
        attendeesBySlot={attendeesBySlot}
        tutorId={profile.id}
        allowProof
        allowCancel
      />

      <SessionGroup
        title="Upcoming"
        description="You can cancel any of these; everyone booked in gets told."
        sessions={upcoming}
        attendeesBySlot={attendeesBySlot}
        tutorId={profile.id}
        allowCancel
      />

      <SessionGroup
        title="Past"
        description="Submit proof for anything you ran but haven't logged yet."
        sessions={past}
        attendeesBySlot={attendeesBySlot}
        tutorId={profile.id}
        allowProof
      />
    </div>
  );
}

function SessionGroup({
  title,
  description,
  sessions,
  attendeesBySlot,
  tutorId,
  allowProof = false,
  allowCancel = false,
}: {
  title: string;
  description: string;
  sessions: TutorSession[];
  attendeesBySlot: Map<string, SlotAttendee[]>;
  tutorId: string;
  allowProof?: boolean;
  allowCancel?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({sessions.length})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        )}
        {sessions.map((session) => {
          const attendees = attendeesBySlot.get(session.id) ?? [];
          const badge = session.hoursStatus
            ? HOURS_BADGE[session.hoursStatus]
            : null;
          const cancelled = session.status === "cancelled";
          // Nothing to log if it was cancelled or already signed off.
          const canSubmit =
            allowProof && !cancelled && session.hoursStatus !== "approved";

          return (
            <div
              key={session.id}
              className="flex flex-col gap-3 border-b pb-4 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {formatSessionDate(session.sessionDate)}
                    {session.courseName ? ` · ${session.courseName}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {SESSION_TIME_LABEL} · {session.locationName} ·{" "}
                    {session.reservedCount} booked
                  </p>
                  {attendees.length > 0 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {attendees
                        .map((a) =>
                          a.isGuest
                            ? `${a.displayName} (guest, ${a.guestEmail})`
                            : a.displayName
                        )
                        .join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {cancelled && <Badge variant="outline">Cancelled</Badge>}
                  {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                  {allowCancel && !cancelled && (
                    <ActionButton
                      action={cancelSlotAction}
                      fields={{ slotId: session.id }}
                      label="Cancel"
                      pendingLabel="Cancelling..."
                      variant="outline"
                      confirmMessage="Cancel this session? Anyone booked in will be told."
                    />
                  )}
                </div>
              </div>

              {canSubmit && (
                <ProofUpload
                  slotId={session.id}
                  tutorId={tutorId}
                  hasProof={session.hoursStatus !== null}
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
