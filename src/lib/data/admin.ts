import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileStatus, RoleCode } from "@/lib/auth/dal";

export type AdminUserRow = {
  id: string;
  fullName: string;
  email: string;
  status: ProfileStatus;
  createdAt: string;
  requestedRoles: RoleCode[];
  grantedRoles: RoleCode[];
};

export async function listUsers(
  supabase: SupabaseClient,
  status?: ProfileStatus
): Promise<AdminUserRow[]> {
  let query = supabase
    .from("profiles")
    .select(
      `
      id, full_name, email, status, created_at,
      requested_roles(role_code),
      user_roles(role_code)
    `
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    createdAt: row.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestedRoles: (row.requested_roles ?? []).map((r: any) => r.role_code),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    grantedRoles: (row.user_roles ?? []).map((r: any) => r.role_code),
  }));
}
