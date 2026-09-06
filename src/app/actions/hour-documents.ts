"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { friendlyRpcError } from "@/lib/rpc-errors";

export type ActionState = { message?: string; ok?: boolean } | undefined;

/**
 * Hands an already-uploaded PDF to a set of tutors.
 *
 * The file itself goes straight from the browser to storage — Server Actions
 * cap request bodies at 1 MB and a scanned form is usually bigger. Only the
 * object path arrives here, and send_hour_document refuses a path that isn't
 * actually in the bucket.
 */
export async function sendHourDocumentAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    return { message: "You're not able to do that." };
  }

  const tutorIds = formData.getAll("tutorIds").map(String).filter(Boolean);
  if (tutorIds.length === 0) {
    return { message: "Pick at least one tutor to send it to." };
  }

  const objectPath = (formData.get("objectPath") as string) || "";
  if (!objectPath) {
    return { message: "Choose a PDF first." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_hour_document", {
    p_tutor_ids: tutorIds,
    p_object_path: objectPath,
    p_file_name: formData.get("fileName") as string,
    p_note: (formData.get("note") as string) || undefined,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/admin/hours-documents");
  revalidatePath("/hours");

  const sent = Number(data ?? 0);
  return {
    ok: true,
    message:
      sent === 0
        ? "Everyone picked already had this document."
        : `Sent to ${sent} tutor${sent === 1 ? "" : "s"}.`,
  };
}

/** Takes one tutor's copy back. The file stays in storage — other tutors may
 * still have been sent the same one. */
export async function revokeHourDocumentAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    return { message: "You're not able to do that." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_hour_document", {
    p_document_id: formData.get("documentId") as string,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/admin/hours-documents");
  revalidatePath("/hours");
  return { ok: true, message: "Removed." };
}
