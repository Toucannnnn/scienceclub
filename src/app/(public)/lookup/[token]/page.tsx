import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatSessionDate, SESSION_TIME_LABEL } from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { cancelGuestReservationAction } from "@/app/actions/guest-bookings";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "My bookings" };

type LookupRow = {
  reservation_id: string;
  session_date: string;
  status: string;
  course_name: string | null;
  tutor_name: string;
  location_name: string | null;
  cancel_token: string | null;
};

/**
 * The emailed door. Unlike the instant lookup, this returns the cancel
 * tokens too — reaching this page means control of the inbox.
 */
export default async function LookupTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_bookings_by_lookup_token", {
    p_token: token,
  });

  if (error) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>This link isn&apos;t valid any more</CardTitle>
          <CardDescription>
            Lookup links expire after 24 hours. Request a fresh one and
            we&apos;ll email it straight over.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/lookup" className={buttonVariants({ variant: "outline" })}>
            Get a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  const bookings = (data ?? []) as LookupRow[];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
        <p className="text-muted-foreground">
          Everything booked with this email.
        </p>
      </div>

      {bookings.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing booked.</p>
      )}

      {bookings.map((booking) => (
        <Card key={booking.reservation_id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-medium">
                {formatSessionDate(booking.session_date)}
                {booking.course_name ? ` · ${booking.course_name}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {booking.tutor_name}
                {booking.location_name ? ` · ${booking.location_name}` : ""} ·{" "}
                {SESSION_TIME_LABEL}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={booking.status === "booked" ? "default" : "outline"}
              >
                {booking.status}
              </Badge>
              {booking.status === "booked" && booking.cancel_token && (
                <ActionButton
                  action={cancelGuestReservationAction}
                  fields={{
                    reservationId: booking.reservation_id,
                    token: booking.cancel_token,
                  }}
                  label="Cancel"
                  pendingLabel="Cancelling..."
                  variant="outline"
                  confirmMessage="Cancel this booking?"
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Link
        href="/calendar"
        className={buttonVariants({ variant: "outline", className: "self-start" })}
      >
        Back to the calendar
      </Link>
    </div>
  );
}
