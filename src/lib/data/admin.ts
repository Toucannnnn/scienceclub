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
      // user_roles points at profiles twice (user_id and granted_by), so the
      // embed has to name the foreign key — without it PostgREST refuses the
      // whole query with PGRST201 "more than one relationship was found".
      // requested_roles has only the one FK, so it needs no hint.
      `
      id, full_name, email, status, created_at,
      requested_roles(role_code),
      user_roles!user_roles_user_id_fkey(role_code)
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
