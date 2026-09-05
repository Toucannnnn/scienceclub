"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile } from "@/lib/auth/dal";
import { friendlyRpcError } from "@/lib/rpc-errors";
import {
  GuestRequestFormSchema,
  type GuestRequestFormState,
} from "@/lib/definitions";

export type ActionState = { message?: string } | undefined;

/** A tutee without an account asks for a tutor. */
export async function createGuestRequestAction(
  _state: GuestRequestFormState,
  formData: FormData
): Promise<GuestRequestFormState> {
  const parsed = GuestRequestFormSchema.safeParse({
    courseId: formData.get("courseId"),
    sessionDate: formData.get("sessionDate"),
    name: formData.get("name"),
    email: formData.get("email"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { courseId, sessionDate, name, email, note } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_tutor_request_as_guest", {
    p_course_id: courseId,
    p_session_date: sessionDate,
    p_name: name,
    p_email: email,
    p_note: note || undefined,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  redirect(`/request/manage/${data.id}?t=${data.guest_manage_token}`);
}

/** A signed-in tutee asks for a tutor. */
export async function createRequestAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireApprovedProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tutor_request", {
    p_course_id: formData.get("courseId") as string,
    p_session_date: formData.get("sessionDate") as string,
    p_note: (formData.get("note") as string) || undefined,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/my-bookings");
  revalidatePath("/calendar");
  return { message: "Request posted — tutors have been notified." };
}

export async function claimRequestAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireApprovedProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_request", {
    p_request_id: formData.get("requestId") as string,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/requests");
  revalidatePath("/availability");
  return { message: "Claimed — it's on your availability now." };
}

export async function unclaimRequestAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireApprovedProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unclaim_request", {
    p_request_id: formData.get("requestId") as string,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/requests");
  revalidatePath("/availability");
  return { message: "Released — it's back in the pool." };
}

export async function cancelRequestAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireApprovedProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_tutor_request", {
    p_request_id: formData.get("requestId") as string,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/my-bookings");
  return { message: "Request cancelled." };
}

export async function cancelGuestRequestAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_tutor_request_as_guest", {
    p_request_id: formData.get("requestId") as string,
    p_token: formData.get("token") as string,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath(`/request/manage/${formData.get("requestId")}`);
  return { message: "Request cancelled." };
}
