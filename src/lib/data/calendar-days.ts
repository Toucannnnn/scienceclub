import type { SupabaseClient } from "@supabase/supabase-js";

/** What the calendar knows about a single date. */
export type CalendarDay = {
  /** True when tutoring can actually happen: a weekday, inside a school
   * term, not a closure, and at least one teacher hosts that weekday. */
  isOpen: boolean;
  /** "Thanksgiving break" and friends — only set for an actual closure, so a
   * Saturday or an out-of-term date has `isOpen: false` and no label. */
  closureLabel: string | null;
  teacherNames: string[];
};

/** Keyed by YYYY-MM-DD. A plain object rather than a Map so it crosses the
 * server/client boundary as-is. */
export type CalendarDayMap = Record<string, CalendarDay>;

export type CourseOption = {
  id: string;
  name: string;
  subjectName: string;
  teacherName: string;
};

/**
 * Day-by-day openness for a date range.
 *
 * The whole range is fetched on the server and handed to the calendar in one
 * payload — every row shares the same handful of teacher-name strings, so it
 * compresses to almost nothing, and the alternative (re-deriving is_school_day
 * in TypeScript from terms + closures) would duplicate the rule that decides
 * whether a booking is legal.
 */
export async function getCalendarDays(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<CalendarDayMap> {
  const { data, error } = await supabase.rpc("get_calendar_days", {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;

  const map: CalendarDayMap = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    map[row.day] = {
      isOpen: row.is_open,
      closureLabel: row.closure_label,
      teacherNames: row.teacher_names ?? [],
    };
  }
  return map;
}

/** Courses a tutee can actually ask for on a given date — i.e. the ones whose
 * teacher holds a room that weekday. Drives the request form's picker so a
 * tutee can't choose Chemistry on a Tuesday and only find out on submit. */
export async function getCoursesForDate(
  supabase: SupabaseClient,
  date: string
): Promise<CourseOption[]> {
  const { data, error } = await supabase.rpc("get_courses_for_date", {
    p_date: date,
  });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id: row.course_id,
    name: row.course_name,
    subjectName: row.subject_name,
    teacherName: row.teacher_name,
  }));
}
