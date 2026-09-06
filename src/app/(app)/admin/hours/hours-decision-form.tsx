"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { reviewHoursAction } from "@/app/actions/hours";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HoursDecisionForm({
  hoursId,
  defaultHours,
}: {
  hoursId: string;
  defaultHours: number;
}) {
  const [state, action, pending] = useActionState(reviewHoursAction, undefined);

  useEffect(() => {
    if (state?.message) toast(state.message);
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="hoursId" value={hoursId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`hours-${hoursId}`}>Hours</Label>
        <Input
          id={`hours-${hoursId}`}
          name="hours"
          type="number"
          step="0.25"
          min="0.25"
          max="8"
          defaultValue={defaultHours}
          className="w-24"
        />
      </div>

      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor={`note-${hoursId}`}>Note (optional)</Label>
        <Input
          id={`note-${hoursId}`}
          name="note"
          maxLength={500}
          placeholder="Why, if you're sending it back"
        />
      </div>

      {/* Two submits on one form: formAction carries the decision, so the
          hours and note the admin typed go with either choice. */}
      <div className="flex gap-2">
        <Button
          type="submit"
          name="approve"
          value="true"
          size="sm"
          disabled={pending}
        >
          {pending ? "Saving..." : "Approve"}
        </Button>
        <Button
          type="submit"
          name="approve"
          value="false"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Send back
        </Button>
      </div>
    </form>
  );
}
