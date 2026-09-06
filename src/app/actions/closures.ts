"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";

export type ActionState = { message?: string } | undefined;

/** Admins write school_closures directly — the table's RLS policy already
 * restricts writes to admins, so there's no RPC to add here. */
export async function addClosureAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    return { message: "You're not able to do that." };
  }

  const closureDate = formData.get("closureDate") as string;
  const label = ((formData.get("label") as string) || "").trim();

  if (!closureDate) return { message: "Pick a date." };
  if (!label) return { message: "Give it a name, e.g. Thanksgiving Break." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("school_closures")
    .upsert(
      { closure_date: closureDate, label, created_by: profile.id },
      { onConflict: "closure_date" }
    );

  if (error) return { message: "Could not save that date." };

  revalidatePath("/admin/closures");
  revalidatePath("/calendar");
  return { message: "Saved." };
}

export async function deleteClosureAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    return { message: "You're not able to do that." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("school_closures")
    .delete()
    .eq("closure_date", formData.get("closureDate") as string);

  if (error) return { message: "Could not remove that date." };

  revalidatePath("/admin/closures");
  revalidatePath("/calendar");
  return { message: "Removed." };
}
