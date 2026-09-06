"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { addClosureAction } from "@/app/actions/closures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClosureForm() {
  const [state, action, pending] = useActionState(addClosureAction, undefined);

  useEffect(() => {
    if (state?.message) toast(state.message);
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="closureDate">Date</Label>
        <Input id="closureDate" name="closureDate" type="date" required />
      </div>
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="label">What is it?</Label>
        <Input
          id="label"
          name="label"
          maxLength={100}
          placeholder="Thanksgiving Break"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Add closure"}
      </Button>
    </form>
  );
}
