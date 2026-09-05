"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { requestTutorCoursesAction } from "@/app/actions/courses";
import type { Course, TutorCourse } from "@/lib/data/courses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  pending: "Pending review",
  rejected: "Declined",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  approved: "default",
  pending: "secondary",
  rejected: "outline",
};

export function CourseRequestForm({
  coursesBySubject,
  myCourses,
}: {
  coursesBySubject: [string, Course[]][];
  myCourses: [string, TutorCourse][];
}) {
  const [state, action, pending] = useActionState(
    requestTutorCoursesAction,
    undefined
  );
  const statusByCourse = new Map(myCourses);

  useEffect(() => {
    if (state?.message) toast(state.message);
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-6">
      {coursesBySubject.map(([subject, courses]) => (
        <div key={subject} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {subject}
          </h3>
          <div className="flex flex-col gap-2">
            {courses.map((course) => {
              const existing = statusByCourse.get(course.id);
              // An approved course is already settled — leave it checked and
              // locked so submitting the form can't look like a downgrade.
              const locked = existing?.status === "approved";

              return (
                <label
                  key={course.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Checkbox
                      name="courseIds"
                      value={course.id}
                      defaultChecked={Boolean(existing)}
                      disabled={locked}
                    />
                    {course.name}
                  </span>
                  {existing && (
                    <Badge variant={STATUS_VARIANT[existing.status]}>
                      {STATUS_LABEL[existing.status]}
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending..." : "Request approval"}
      </Button>
    </form>
  );
}
