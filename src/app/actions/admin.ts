"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile, hasRole, type RoleCode } from "@/lib/auth/dal";

export type ActionState = { message?: string } | undefined;

async function requireAdmin() {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    throw new Error("not_authorized");
  }
  return profile;
}

export async function approveUserAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();
  const userId = formData.get("userId") as string;
  const roles = formData.getAll("roles") as RoleCode[];

  if (roles.length === 0) {
    return { message: "Select at least one role to grant." };
  }

  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ status: "approved", approved_by: admin.id, approved_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) return { message: "Could not approve that account." };

  const { error: rolesError } = await supabase
    .from("user_roles")
    .insert(roles.map((role_code) => ({ user_id: userId, role_code, granted_by: admin.id })));

  if (rolesError) return { message: "Approved, but granting roles failed — try again." };

  revalidatePath("/admin/users");
  return { message: "Account approved." };
}

export async function rejectUserAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const userId = formData.get("userId") as string;
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", userId);

  if (error) return { message: "Could not reject that account." };

  revalidatePath("/admin/users");
  return { message: "Account rejected." };
}

export async function setUserRoleAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();
  const userId = formData.get("userId") as string;
  const role = formData.get("role") as RoleCode;
  const grant = formData.get("grant") === "true";

  const supabase = await createClient();

  if (grant) {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role_code: role, granted_by: admin.id });
    if (error) return { message: "Could not grant that role." };
  } else {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role_code", role);
    if (error) return { message: "Could not remove that role." };
  }

  revalidatePath("/admin/users");
  return { message: grant ? "Role granted." : "Role removed." };
}
