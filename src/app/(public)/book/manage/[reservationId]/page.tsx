import { createClient } from "@/lib/supabase/server";
import { formatSlotTimeRange } from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { cancelGuestReservationAction } from "@/app/actions/guest-bookings";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Manage your booking" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  booked: "default",
  cancelled: "outline",
  no_show: "outline",
  completed: "secondary",
};

// This one page doubles as both the post-booking confirmation screen (the
// link a guest lands on right after reserving) and the page they return to
// later via the same emailed link to cancel — no separate confirmation
// route, since there's nothing more to show on first visit than "here's
// your booking, here's how to cancel it."
export default async function GuestManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ reservationId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { reservationId } = await params;
  const { t: token } = await searchParams;

  const supabase = await createClient();
  const { data, error } = token
    ? await supabase.rpc("get_guest_reservation", {
        p_reservation_id: reservationId,
        p_token: token,
      })
    : { data: null, error: null };

  const reservation = data?.[0];

  if (error || !reservation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This booking link isn&apos;t valid</CardTitle>
          <CardDescription>
            Check you copied the whole link from your confirmation email. If
            you think this is a mistake, ask an admin for help.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isActive = reservation.status === "booked";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>
            {formatSlotTimeRange(reservation.starts_at, reservation.ends_at)}
          </CardTitle>
          <Badge variant={STATUS_VARIANT[reservation.status] ?? "outline"}>
            {reservation.status}
          </Badge>
        </div>
        <CardDescription>
          {reservation.tutor_name} · {reservation.location_name}
          {reservation.subject_name ? ` · ${reservation.subject_name}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Booked under {reservation.guest_name}. Bookmark this page or keep
          your confirmation email — this is the only way to manage this
          booking.
        </p>
        {isActive && (
          <ActionButton
            action={cancelGuestReservationAction}
            fields={{ reservationId, token: token ?? "" }}
            label="Cancel this booking"
            pendingLabel="Cancelling..."
            variant="outline"
            confirmMessage="Cancel this booking?"
          />
        )}
      </CardContent>
    </Card>
  );
}
