import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTutorCourseStandings,
  type TutorCourseStanding,
} from "@/lib/data/courses";
import { ActionButton } from "@/components/action-button";
import {
  grantTutorCourseAction,
  revokeTutorCourseAction,
} from "@/app/actions/courses";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Tutor" };

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  approved: { label: "Approved", variant: "default" },
  pending: { label: "Requested", variant: "secondary" },
  rejected: { label: "Declined", variant: "outline" },
  revoked: { label: "Removed", variant: "outline" },
};

export default async function AdminTutorDetailPage({
  params,
}: {
  params: Promise<{ tutorId: string }>;
}) {
  const { tutorId } = await params;
  const supabase = await createClient();

  const [{ data: profile }, standings] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, status")
      .eq("id", tutorId)
      .maybeSingle(),
    getTutorCourseStandings(supabase, tutorId),
  ]);

  if (!profile) notFound();

  // Group by subject so the list reads the way the courses do elsewhere.
  const bySubject = new Map<string, TutorCourseStanding[]>();
  for (const standing of standings) {
    const list = bySubject.get(standing.subjectName) ?? [];
    list.push(standing);
    bySubject.set(standing.subjectName, list);
  }

  const approvedCount = standings.filter((s) => s.status === "approved").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.full_name}
          </h1>
          <p className="text-muted-foreground">
            {profile.email} · approved to tutor {approvedCount} course
            {approvedCount === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/tutors"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to roster
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Courses</CardTitle>
          <CardDescription>
            Approve a course here and the tutor can post sessions for it
            straight away — they don&apos;t need to request it first. Removing
            one stops new sessions; anything already posted is left alone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {[...bySubject.entries()].map(([subject, courses]) => (
            <div key={subject} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {subject}
              </h2>
              {courses.map((course) => {
                const badge = course.status ? STATUS[course.status] : null;
                const isApproved = course.status === "approved";

                return (
                  <div
                    key={course.courseId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      {course.courseName}
                      {badge && (
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      )}
                    </span>
                    {isApproved ? (
                      <ActionButton
                        action={revokeTutorCourseAction}
                        fields={{ tutorId, courseId: course.courseId }}
                        label="Remove"
                        pendingLabel="Removing..."
                        variant="outline"
                        confirmMessage={`Remove ${course.courseName} from ${profile.full_name}? They won't be able to post new sessions for it.`}
                      />
                    ) : (
                      <ActionButton
                        action={grantTutorCourseAction}
                        fields={{ tutorId, courseId: course.courseId }}
                        label={course.status === "pending" ? "Approve" : "Grant"}
                        pendingLabel="Saving..."
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
