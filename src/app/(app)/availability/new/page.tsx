import { redirect } from "next/navigation";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCourses, getMyTutorCourses } from "@/lib/data/courses";
import { clubToday } from "@/lib/format";
import { NewSlotForm } from "./new-slot-form";

export const metadata = { title: "Post a session" };

export default async function NewSlotPage() {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "tutor")) {
    redirect("/availability");
  }

  const supabase = await createClient();
  const [courses, myCourses] = await Promise.all([
    getCourses(supabase),
    getMyTutorCourses(supabase, profile.id),
  ]);

  const approvedCourses = courses.filter(
    (course) => myCourses.get(course.id)?.status === "approved"
  );

  return <NewSlotForm approvedCourses={approvedCourses} minDate={clubToday()} />;
}
