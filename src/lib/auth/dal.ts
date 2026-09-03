import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";
export type RoleCode = "tutor" | "tutee" | "admin";

export type ProfileWithRoles = {
  id: string;
  fullName: string;
  email: string;
  status: ProfileStatus;
  roles: RoleCode[];
};

/**
 * Data Access Layer for auth/authorization. Centralizing these checks here
 * (rather than scattering them across pages) means every caller — Server
 * Components, Server Actions, Route Handlers — gets the same guarantees.
 * The proxy (src/proxy.ts) only does a fast, optimistic redirect; this is
 * the real check, backed by the database.
 */

// Memoized per-request: safe to call this from many components without
// triggering duplicate auth round-trips.
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Redirects to /login if there's no authenticated session. */
export async function requireAuthUser() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export const getProfileWithRoles = cache(
  async (): Promise<ProfileWithRoles | null> => {
    const user = await getAuthUser();
    if (!user) return null;

    const supabase = await createClient();
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("id", user.id)
        .single(),
      supabase.from("user_roles").select("role_code").eq("user_id", user.id),
    ]);

    if (!profile) return null;

    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      status: profile.status as ProfileStatus,
      roles: (roleRows ?? []).map((r) => r.role_code as RoleCode),
    };
  }
);

/**
 * For pages under (app)/(admin): requires an authenticated, admin-approved
 * profile. Sends unapproved users to the waiting page and unauthenticated
 * users to login.
 */
export async function requireApprovedProfile(): Promise<ProfileWithRoles> {
  await requireAuthUser();
  const profile = await getProfileWithRoles();

  if (!profile) {
    redirect("/login");
  }
  if (profile.status !== "approved") {
    redirect("/pending-approval");
  }
  return profile;
}

export function hasRole(profile: ProfileWithRoles, role: RoleCode) {
  return profile.roles.includes(role);
}
