"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { setUserRoleAction } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import type { RoleCode } from "@/lib/auth/dal";

const ALL_ROLES: RoleCode[] = ["tutor", "tutee", "admin"];

function RoleToggle({
  userId,
  role,
  granted,
}: {
  userId: string;
  role: RoleCode;
  granted: boolean;
}) {
  const [state, action, pending] = useActionState(setUserRoleAction, undefined);

  useEffect(() => {
    if (state?.message) toast(state.message);
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="grant" value={(!granted).toString()} />
      <button type="submit" disabled={pending} className="cursor-pointer">
        <Badge
          variant={granted ? "default" : "outline"}
          className="capitalize"
        >
          {role}
        </Badge>
      </button>
    </form>
  );
}

export function RoleToggles({
  userId,
  grantedRoles,
}: {
  userId: string;
  grantedRoles: RoleCode[];
}) {
  return (
    <div className="flex gap-1.5">
      {ALL_ROLES.map((role) => (
        <RoleToggle
          key={role}
          userId={userId}
          role={role}
          granted={grantedRoles.includes(role)}
        />
      ))}
    </div>
  );
}
