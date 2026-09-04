import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPublicOpenSlot } from "@/lib/data/public-slots";
import { formatSlotTimeRange } from "@/lib/format";
import { GuestBookingForm } from "./guest-booking-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Book a session" };

export default async function GuestBookSlotPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const user = await getAuthUser();
  if (user) redirect("/calendar");

  const { slotId } = await params;
  const supabase = await createClient();
  const slot = await getPublicOpenSlot(supabase, slotId);

  if (!slot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This slot isn&apos;t available</CardTitle>
          <CardDescription>
            It may have filled up, been cancelled, or already started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/book" className={buttonVariants({ variant: "outline" })}>
            See other open slots
          </Link>
        </CardContent>
      </Card>
    );
  }

  const spotsLeft = slot.capacity - slot.reserved_count;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{formatSlotTimeRange(slot.starts_at, slot.ends_at)}</CardTitle>
          <CardDescription>
            {slot.tutor_name} · {slot.location_name}
            {slot.subject_name ? ` · ${slot.subject_name}` : ""}
            {slot.max_capacity > 1
              ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
              : ""}
          </CardDescription>
        </CardHeader>
        {slot.notes && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{slot.notes}</p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <GuestBookingForm slotId={slot.id} />
        </CardContent>
      </Card>
    </div>
  );
}
