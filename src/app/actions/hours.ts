"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { friendlyRpcError } from "@/lib/rpc-errors";

export type ActionState = { message?: string } | undefined;

/**
 * Records a session the tutor ran. The photo itself is uploaded straight to
 * storage from the browser — Server Actions cap request bodies at 1 MB by
 * default and a phone photo is several times that. All that arrives here is
 * the object path, and submit_session_hours re-checks that the path sits
 * under this tutor's own folder.
 */
export async function submitHoursAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireApprovedProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_session_hours", {
    p_slot_id: formData.get("slotId") as string,
    p_object_path: (formData.get("objectPath") as string) || undefined,
    p_note: (formData.get("note") as string) || undefined,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/availability");
  revalidatePath("/hours");
  return { message: "Submitted — an admin will review it." };
}

export async function reviewHoursAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    return { message: "You're not able to do that." };
  }

  const rawHours = formData.get("hours") as string | null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_session_hours", {
    p_hours_id: formData.get("hoursId") as string,
    p_approve: formData.get("approve") === "true",
    p_hours: rawHours ? Number(rawHours) : undefined,
    p_note: (formData.get("note") as string) || undefined,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/admin/hours");
  return {
    message: formData.get("approve") === "true" ? "Approved." : "Sent back.",
  };
}
