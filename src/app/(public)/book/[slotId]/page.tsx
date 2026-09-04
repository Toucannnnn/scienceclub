import Link from "next/link";
import { CalendarDaysIcon, MapPinIcon, UserIcon, UsersIcon } from "lucide-react";
import { getProfileWithRoles } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPublicOpenSlot } from "@/lib/data/public-slots";
import { formatSlotTimeRange } from "@/lib/format";
import { GuestBookingForm } from "./guest-booking-form";
import { ActionButton } from "@/components/action-button";
import { reserveSlotAction } from "@/app/actions/slots";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Book a session" };

export default async function BookSlotPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params;
  const supabase = await createClient();
  const [slot, profile] = await Promise.all([
    getPublicOpenSlot(supabase, slotId),
    getProfileWithRoles(),
  ]);

  if (!slot) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>This slot isn&apos;t available</CardTitle>
          <CardDescription>
            It may have filled up, been cancelled, or already started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/calendar" className={buttonVariants({ variant: "outline" })}>
            Back to the calendar
          </Link>
        </CardContent>
      </Card>
    );
  }

  const spotsLeft = slot.capacity - slot.reserved_count;
  const isApprovedMember = profile?.status === "approved";
  const isOwnSlot = slot.tutor_id === profile?.id;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {formatSlotTimeRange(slot.starts_at, slot.ends_at)}
          </CardTitle>
          {slot.subject_name && (
            <CardDescription>{slot.subject_name}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <UserIcon className="size-4" /> {slot.tutor_name}
          </p>
          <p className="flex items-center gap-2">
            <MapPinIcon className="size-4" /> {slot.location_name}
          </p>
          {slot.max_capacity > 1 && (
            <p className="flex items-center gap-2">
              <UsersIcon className="size-4" /> {spotsLeft} of {slot.capacity} spot
              {slot.capacity === 1 ? "" : "s"} left
            </p>
          )}
          {slot.notes && <p className="pt-1 text-foreground">{slot.notes}</p>}
        </CardContent>
      </Card>

      {isOwnSlot ? (
        <Card>
          <CardHeader>
            <CardTitle>This is your own slot</CardTitle>
            <CardDescription>
              You posted this one — manage it from your availability page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/availability"
              className={buttonVariants({ variant: "outline" })}
            >
              My availability
            </Link>
          </CardContent>
        </Card>
      ) : isApprovedMember ? (
        <Card>
          <CardHeader>
            <CardTitle>Book this slot</CardTitle>
            <CardDescription>
              Booking as {profile.fullName} — it&apos;ll show up under My
              bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionButton
              action={reserveSlotAction}
              fields={{ slotId: slot.id }}
              label="Reserve this slot"
              pendingLabel="Reserving..."
            />
          </CardContent>
        </Card>
      ) : profile ? (
        <Card>
          <CardHeader>
            <CardTitle>Your account is still pending</CardTitle>
            <CardDescription>
              An admin needs to approve it before you can book with your
              account. You can log out and book as a guest instead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/pending-approval"
              className={buttonVariants({ variant: "outline" })}
            >
              Check status
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>
              No account needed — just tell us who&apos;s coming.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuestBookingForm slotId={slot.id} />
          </CardContent>
        </Card>
      )}

      <Link
        href="/calendar"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <CalendarDaysIcon className="size-4" /> Back to the calendar
      </Link>
    </div>
  );
}
