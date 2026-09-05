import Link from "next/link";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getTutorInbox } from "@/lib/data/requests";
import { getApprovedCourseNames } from "@/lib/data/courses";
import { clubToday, formatSessionDate } from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { claimRequestAction, unclaimRequestAction } from "@/app/actions/requests";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Tutor requests" };

export default async function TutorRequestsPage() {
  const profile = await requireApprovedProfile();

  if (!hasRole(profile, "tutor")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tutor requests</CardTitle>
          <CardDescription>
            Only tutors can pick up requests. Ask an admin if you think you
            should have the tutor role.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createClient();
  const today = clubToday();
  const [requests, approvedCourses] = await Promise.all([
    getTutorInbox(supabase, profile.id, today),
    getApprovedCourseNames(supabase, profile.id),
  ]);

  const mine = requests.filter((r) => r.claimedBy === profile.id);
  const open = requests.filter((r) => r.status === "open");
  // Still on the board after the noon cutoff. A tutor who actually turns up
  // can still take these — that's what makes the session recordable later.
  const unclaimed = requests.filter((r) => r.status === "unclaimed");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tutor requests
        </h1>
        <p className="text-muted-foreground">
          {approvedCourses.length === 0
            ? "You'll see requests here once you're approved for a course."
            : `Requests for ${approvedCourses.join(", ")}.`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Waiting for a tutor ({open.length})</CardTitle>
          <CardDescription>
            Claiming one creates a one-on-one session at 12:15 with the tutee
            already booked in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {open.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing waiting right now.
            </p>
          )}
          {open.map((request) => (
            <RequestRow key={request.id} request={request} action="claim" />
          ))}
        </CardContent>
      </Card>

      {unclaimed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nobody claimed these ({unclaimed.length})</CardTitle>
            <CardDescription>
              The noon deadline passed without anyone signing up, so the tutee
              was told to go to the teacher directly. If you showed up and
              helped anyway, claim it here so it counts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {unclaimed.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                action="claim"
                claimLabel="I tutored this"
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Claimed by you ({mine.length})</CardTitle>
          <CardDescription>
            You can back out up to the day before. After that, talk to an
            admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {mine.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t claimed anything yet.
            </p>
          )}
          {mine.map((request) => (
            <RequestRow key={request.id} request={request} action="unclaim" />
          ))}
        </CardContent>
      </Card>

      <Link
        href="/availability"
        className={buttonVariants({ variant: "outline", className: "self-start" })}
      >
        Tutor availability
      </Link>
    </div>
  );
}

function RequestRow({
  request,
  action,
  claimLabel = "Claim",
}: {
  request: Awaited<ReturnType<typeof getTutorInbox>>[number];
  action: "claim" | "unclaim";
  claimLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <div>
        <p className="font-medium">
          {request.courseName}
          <span className="font-normal text-muted-foreground">
            {" "}
            · {formatSessionDate(request.sessionDate)}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {request.requesterName} · 12:15 – 12:45 PM
        </p>
        {request.note && (
          <p className="mt-1 text-sm text-muted-foreground">
            &ldquo;{request.note}&rdquo;
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {request.status === "unclaimed" && (
          <Badge variant="outline">Unclaimed</Badge>
        )}
        {action === "claim" ? (
          <ActionButton
            action={claimRequestAction}
            fields={{ requestId: request.id }}
            label={claimLabel}
            pendingLabel="Claiming..."
          />
        ) : (
          <ActionButton
            action={unclaimRequestAction}
            fields={{ requestId: request.id }}
            label="Release"
            pendingLabel="Releasing..."
            variant="outline"
            confirmMessage="Release this request so another tutor can take it?"
          />
        )}
      </div>
    </div>
  );
}
