"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { approveUserAction, rejectUserAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { RoleCode } from "@/lib/auth/dal";

export function ApproveUserForm({
  userId,
  requestedRoles,
}: {
  userId: string;
  requestedRoles: RoleCode[];
}) {
  const [approveState, approveAction, approving] = useActionState(
    approveUserAction,
    undefined
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectUserAction,
    undefined
  );

  useEffect(() => {
    if (approveState?.message) toast(approveState.message);
  }, [approveState]);
  useEffect(() => {
    if (rejectState?.message) toast(rejectState.message);
  }, [rejectState]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <form action={approveAction} className="flex items-center gap-3">
        <input type="hidden" name="userId" value={userId} />
        {(["tutor", "tutee", "admin"] as const).map((role) => (
          <label key={role} className="flex items-center gap-1.5 text-sm">
            <Checkbox
              name="roles"
              value={role}
              defaultChecked={requestedRoles.includes(role)}
            />
            <span className="capitalize">{role}</span>
          </label>
        ))}
        <Button type="submit" size="sm" disabled={approving}>
          {approving ? "Approving..." : "Approve"}
        </Button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="userId" value={userId} />
        <Button type="submit" size="sm" variant="outline" disabled={rejecting}>
          {rejecting ? "Rejecting..." : "Reject"}
        </Button>
      </form>
    </div>
  );
}
