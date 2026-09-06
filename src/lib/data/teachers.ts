import type { SupabaseClient } from "@supabase/supabase-js";

export type Teacher = {
  id: string;
  name: string;
  subjectId: string;
  /** Postgres `extract(dow)` numbering, which matches JS getDay(): 0 = Sunday
   * through 6 = Saturday. The room is only open on these days. */
  weekdays: number[];
};

/** Every teacher hosting a tutoring room. Readable signed-out since 0015 —
 * the calendar needs it to say who's hosting on a given date. */
export async function getActiveTeachers(
  supabase: SupabaseClient
): Promise<Teacher[]> {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, name, subject_id, weekdays")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    subjectId: row.subject_id,
    weekdays: row.weekdays ?? [],
  }));
}
