import { redirect } from "next/navigation";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCourses, getMyTutorCourses } from "@/lib/data/courses";
import { getActiveTeachers } from "@/lib/data/teachers";
import { getPostedSessionDates } from "@/lib/data/slots";
import { getCalendarDays } from "@/lib/data/calendar-days";
import { clubToday, parseSessionDate } from "@/lib/format";
import { NewSlotForm, type PostableDay, type PostableCourse } from "./new-slot-form";

export const metadata = { title: "Post a session" };

// How far ahead the picker offers. The school year runs to mid-May, but a
// dropdown of every remaining school day is unusable — a term's worth of
// Mondays-to-Thursdays is plenty to plan against.
const WINDOW_DAYS = 90;

/** YYYY-MM-DD for `days` days after `ymd`, via UTC so no DST boundary can
 * shift the result. Only the calendar date matters here, never a time. */
function shiftDate(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export default async function NewSlotPage() {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "tutor")) {
    redirect("/availability");
  }

  const supabase = await createClient();
  const today = clubToday();
  const windowEnd = shiftDate(today, WINDOW_DAYS);

  const [courses, myCourses, teachers, dayInfo, alreadyPosted] =
    await Promise.all([
      getCourses(supabase),
      getMyTutorCourses(supabase, profile.id),
      getActiveTeachers(supabase),
      getCalendarDays(supabase, today, windowEnd),
      getPostedSessionDates(supabase, profile.id, today),
    ]);

  const approved = courses.filter(
    (course) => myCourses.get(course.id)?.status === "approved"
  );

  // A course is taught in its subject's teacher's room, so the teacher's
  // weekdays are the course's weekdays. This is the same rule course_hosts_on
  // applies in SQL — the picker just applies it before the tutor submits
  // rather than after.
  const teacherBySubject = new Map(teachers.map((t) => [t.subjectId, t]));

  const postableCourses: PostableCourse[] = approved.map((course) => {
    const teacher = teacherBySubject.get(course.subjectId);
    return {
      id: course.id,
      name: course.name,
      subjectName: course.subjectName,
      teacherName: teacher?.name ?? null,
      weekdays: teacher?.weekdays ?? [],
    };
  });

  // Every date the tutor could actually post on: the club is open, they
  // haven't already got a session that day, and at least one of their own
  // approved courses is hosted. Anything failing one of those is simply not
  // offered, so create_slot's four rejections become unreachable from here.
  const days: PostableDay[] = [];
  for (let i = 0; i <= WINDOW_DAYS; i++) {
    const date = shiftDate(today, i);
    if (!dayInfo[date]?.isOpen) continue;
    if (alreadyPosted.has(date)) continue;

    // getDay() on a local-midnight Date, never getUTCDay() — the whole point
    // of parseSessionDate is that the weekday survives the timezone.
    const weekday = parseSessionDate(date).getDay();
    const courseIds = postableCourses
      .filter((course) => course.weekdays.includes(weekday))
      .map((course) => course.id);

    if (courseIds.length > 0) days.push({ date, courseIds });
  }

  return (
    <NewSlotForm
      days={days}
      courses={postableCourses}
      // Told apart on purpose: "you have no approved courses" and "your
      // courses just aren't hosted in the next three months" need completely
      // different advice.
      hasApprovedCourses={postableCourses.length > 0}
      blockedDays={alreadyPosted.size}
    />
  );
}
