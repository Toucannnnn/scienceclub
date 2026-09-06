import type { SupabaseClient } from "@supabase/supabase-js";

export type HoursStatus = "submitted" | "approved" | "rejected";

export type MyHoursRow = {
  id: string;
  sessionDate: string;
  courseName: string | null;
  helpMode: "individual" | "group";
  attendees: number;
  hours: number;
  status: HoursStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type ReviewHoursRow = MyHoursRow & {
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  proofObjectPath: string | null;
  tutorNote: string | null;
};

export async function getMyHours(
  supabase: SupabaseClient
): Promise<MyHoursRow[]> {
  const { data, error } = await supabase.rpc("get_my_hours");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    sessionDate: row.session_date,
    courseName: row.course_name,
    helpMode: row.help_mode,
    attendees: row.attendees ?? 0,
    hours: Number(row.hours),
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
  }));
}

/** Admin review queue. `status` of "all" returns the whole ledger. */
export async function getHoursForReview(
  supabase: SupabaseClient,
  status: HoursStatus | "all" = "submitted"
): Promise<ReviewHoursRow[]> {
  const { data, error } = await supabase.rpc("get_hours_for_review", {
    p_status: status,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    tutorId: row.tutor_id,
    tutorName: row.tutor_name,
    tutorEmail: row.tutor_email,
    sessionDate: row.session_date,
    courseName: row.course_name,
    helpMode: "group",
    attendees: 0,
    hours: Number(row.hours),
    status: row.status,
    proofObjectPath: row.proof_object_path,
    tutorNote: row.tutor_note,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
  }));
}

/** Sessions a tutor has run or will run, with any hours already logged.
 * Drives the Past / Today / Upcoming split on tutor availability. */
export type TutorSession = {
  id: string;
  sessionDate: string;
  courseName: string | null;
  locationName: string;
  status: string;
  reservedCount: number;
  hoursStatus: HoursStatus | null;
};

export async function getTutorSessions(
  supabase: SupabaseClient,
  tutorId: string
): Promise<TutorSession[]> {
  const { data, error } = await supabase
    .from("availability_slots")
    .select(
      `id, session_date, status, reserved_count,
       course:courses(name), location:locations(name),
       hours:volunteer_hours(status)`
    )
    .eq("tutor_id", tutorId)
    .order("session_date", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    sessionDate: row.session_date,
    courseName: row.course?.name ?? null,
    locationName: row.location?.name ?? "Room 101",
    status: row.status,
    reservedCount: row.reserved_count ?? 0,
    // volunteer_hours is a one-to-one via a unique FK, but PostgREST still
    // returns it as an array.
    hoursStatus: row.hours?.[0]?.status ?? null,
  }));
}
