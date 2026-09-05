"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { friendlyRpcError } from "@/lib/rpc-errors";

export type ActionState = { message?: string } | undefined;

/** A tutor asks to be approved for the courses they checked. Re-requesting a
 * previously rejected course puts it back in the queue; already-approved
 * courses are left alone by the RPC. */
export async function requestTutorCoursesAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "tutor")) {
    return { message: "Only tutors can request course approval." };
  }

  const courseIds = formData.getAll("courseIds") as string[];
  if (courseIds.length === 0) {
    return { message: "Pick at least one course." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_tutor_courses", {
    p_course_ids: courseIds,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/tutor/courses");
  return { message: "Request sent — an admin will review it." };
}

export async function withdrawTutorCourseAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireApprovedProfile();
  const courseId = formData.get("courseId") as string;

  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_tutor_course", {
    p_course_id: courseId,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/tutor/courses");
  return { message: "Removed." };
}

export async function decideTutorCourseAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    return { message: "You're not able to do that." };
  }

  const tutorId = formData.get("tutorId") as string;
  const courseId = formData.get("courseId") as string;
  const approve = formData.get("approve") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_tutor_course", {
    p_tutor_id: tutorId,
    p_course_id: courseId,
    p_approve: approve,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/admin/users");
  return { message: approve ? "Course approved." : "Request declined." };
}
