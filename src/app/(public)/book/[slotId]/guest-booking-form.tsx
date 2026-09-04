"use client";

import { useActionState } from "react";
import { bookGuestSlotAction } from "@/app/actions/guest-bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GuestBookingForm({ slotId }: { slotId: string }) {
  const [state, action, pending] = useActionState(bookGuestSlotAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slotId" value={slotId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required />
        {state?.errors?.name && (
          <p className="text-sm text-destructive">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Your email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state?.errors?.email && (
          <p className="text-sm text-destructive">{state.errors.email[0]}</p>
        )}
        <p className="text-xs text-muted-foreground">
          We&apos;ll email you a confirmation and a link to manage or cancel
          this booking.
        </p>
      </div>

      {state?.message && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Booking..." : "Confirm booking"}
      </Button>
    </form>
  );
}
