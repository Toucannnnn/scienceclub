"use client";

import { ActionButton } from "@/components/action-button";
import { decideTutorCourseAction } from "@/app/actions/courses";

export function CourseDecisionButtons({
  tutorId,
  courseId,
}: {
  tutorId: string;
  courseId: string;
}) {
  return (
    <div className="flex gap-2">
      <ActionButton
        action={decideTutorCourseAction}
        fields={{ tutorId, courseId, approve: "true" }}
        label="Approve"
        pendingLabel="Approving..."
      />
      <ActionButton
        action={decideTutorCourseAction}
        fields={{ tutorId, courseId, approve: "false" }}
        label="Decline"
        pendingLabel="Declining..."
        variant="outline"
      />
    </div>
  );
}
