"use client";

import { useActionState } from "react";
import { MailIcon, SearchIcon } from "lucide-react";
import {
  lookupBookingsAction,
  emailLookupLinkAction,
  type LookupState,
} from "@/app/actions/lookup";
import { formatSessionDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function LookupForm() {
  const [lookupState, lookupAction, lookingUp] = useActionState<
    LookupState,
    FormData
  >(lookupBookingsAction, undefined);
  const [emailState, emailAction, emailing] = useActionState<
    LookupState,
    FormData
  >(emailLookupLinkAction, undefined);

  const bookings = lookupState?.bookings ?? [];

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">The email you booked with</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" formAction={lookupAction} disabled={lookingUp}>
            <SearchIcon />
            {lookingUp ? "Looking..." : "Show my bookings"}
          </Button>
          <Button
            type="submit"
            variant="outline"
            formAction={emailAction}
            disabled={emailing}
          >
            <MailIcon />
            {emailing ? "Sending..." : "Email me a link instead"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing them here is quicker. The emailed link is the one that also
          lets you cancel — it proves the inbox is yours.
        </p>
      </form>

      {(lookupState?.message || emailState?.message) && (
        <p className="text-sm text-muted-foreground">
          {lookupState?.message ?? emailState?.message}
        </p>
      )}

      {lookupState?.searched && bookings.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No bookings found for that email.
        </p>
      )}

      {bookings.length > 0 && (
        <div className="flex flex-col gap-3">
          {bookings.map((booking, i) => (
            <Card key={`${booking.session_date}-${i}`} className="border-border/70">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-medium">
                    {formatSessionDate(booking.session_date)}
                    {booking.course_name ? ` · ${booking.course_name}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.tutor_name}
                    {booking.location_name ? ` · ${booking.location_name}` : ""}{" "}
                    · 12:15 – 12:45 PM
                  </p>
                </div>
                <Badge
                  variant={booking.status === "booked" ? "default" : "outline"}
                >
                  {booking.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">
            Need to cancel one? Use &ldquo;Email me a link instead&rdquo; above.
          </p>
        </div>
      )}
    </div>
  );
}
