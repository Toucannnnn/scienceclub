import type { SupabaseClient } from "@supabase/supabase-js";

export type RequestStatus = "open" | "claimed" | "unclaimed" | "cancelled";

/** What the calendar shows publicly. Deliberately no requester name — a
 * request reveals that a named student needs help with a subject, which is
 * nobody else's business. */
export type PublicRequest = {
  id: string;
  session_date: string;
  course_name: string;
  subject_name: string;
  teacher_name: string | null;
  status: RequestStatus;
  /** False once the noon cutoff has passed — the ticket stays visible, but
   * advance signup is closed. A tutor can still claim it late from their
   * own inbox. */
  claimable: boolean;
};

/** A tutor's inbox row — includes who asked, since a tutor who's about to
 * take the session needs to know. */
export type TutorInboxRequest = {
  id: string;
  sessionDate: string;
  courseId: string;
  courseName: string;
  teacherName: string | null;
  requesterName: string;
  note: string | null;
  status: RequestStatus;
  claimedBy: string | null;
  claimable: boolean;
};

export async function getPublicRequests(
  supabase: SupabaseClient
): Promise<PublicRequest[]> {
  const { data, error } = await supabase.rpc("get_public_requests");
  if (error) throw error;
  return (data ?? []) as PublicRequest[];
}

/**
 * Requests a tutor can see: RLS already limits this to courses they're
 * approved for, plus anything they claimed themselves.
 */
export async function getTutorInbox(
  supabase: SupabaseClient,
  tutorId: string,
  today: string
): Promise<TutorInboxRequest[]> {
  const { data, error } = await supabase
    .from("tutoring_requests")
    .select(
      `id, session_date, course_id, note, status, claimed_by,
       requester:profiles!tutoring_requests_requester_id_fkey(full_name),
       guest_name,
       course:courses(name)`
    )
    .in("status", ["open", "claimed", "unclaimed"])
    .gte("session_date", today)
    .order("session_date", { ascending: true });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    sessionDate: row.session_date,
    courseId: row.course_id,
    courseName: row.course?.name ?? "Unknown course",
    teacherName: null,
    requesterName: row.requester?.full_name ?? row.guest_name ?? "A tutee",
    note: row.note,
    status: row.status,
    claimedBy: row.claimed_by,
    // Mirrors the RPC's own rule: open, and still before noon on the day.
    claimable:
      row.status === "open" && new Date().toISOString().slice(0, 10) <= row.session_date,
  }));
}
