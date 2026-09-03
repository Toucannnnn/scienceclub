"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ActionState = { message?: string } | undefined;

export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  variant = "default",
  confirmMessage,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.message) toast(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {pending ? (pendingLabel ?? "Working...") : label}
      </Button>
    </form>
  );
}
