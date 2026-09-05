import type { SupabaseClient } from "@supabase/supabase-js";

export type TutorCourseStatus = "pending" | "approved" | "rejected";

export type Course = {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  sortOrder: number;
};

export type TutorCourse = {
  courseId: string;
  status: TutorCourseStatus;
  requestedAt: string;
  decidedAt: string | null;
};

export type PendingTutorCourse = {
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  courseId: string;
  courseName: string;
  subjectName: string;
  requestedAt: string;
};

/** Every active course, grouped-ready: ordered by subject then the course's
 * own sort_order, so "Biology / Biology Advanced / AP Biology" stays in that
 * order rather than alphabetical. */
export async function getCourses(supabase: SupabaseClient): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, sort_order, subject_id, subject:subjects(name)")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    subjectId: row.subject_id,
    subjectName: row.subject?.name ?? "Other",
    sortOrder: row.sort_order,
  }));

  return rows.sort(
    (a, b) =>
      a.subjectName.localeCompare(b.subjectName) || a.sortOrder - b.sortOrder
  );
}

/** The signed-in tutor's own course approvals, keyed by course id. RLS
 * already scopes this to auth.uid(). */
export async function getMyTutorCourses(
  supabase: SupabaseClient,
  tutorId: string
): Promise<Map<string, TutorCourse>> {
  const { data, error } = await supabase
    .from("tutor_courses")
    .select("course_id, status, requested_at, decided_at")
    .eq("tutor_id", tutorId);

  if (error) throw error;

  return new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((row: any) => [
      row.course_id as string,
      {
        courseId: row.course_id,
        status: row.status,
        requestedAt: row.requested_at,
        decidedAt: row.decided_at,
      },
    ])
  );
}

/** Course names a tutor is approved for — what they can actually post
 * availability against. */
export async function getApprovedCourseNames(
  supabase: SupabaseClient,
  tutorId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("tutor_courses")
    .select("course:courses(name)")
    .eq("tutor_id", tutorId)
    .eq("status", "approved");

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => row.course?.name).filter(Boolean);
}

/** Admin view of every outstanding course request. */
export async function getPendingTutorCourses(
  supabase: SupabaseClient
): Promise<PendingTutorCourse[]> {
  const { data, error } = await supabase.rpc("get_pending_tutor_courses");
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    tutorId: row.tutor_id,
    tutorName: row.tutor_name,
    tutorEmail: row.tutor_email,
    courseId: row.course_id,
    courseName: row.course_name,
    subjectName: row.subject_name,
    requestedAt: row.requested_at,
  }));
}
