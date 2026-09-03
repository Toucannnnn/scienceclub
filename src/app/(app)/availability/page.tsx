import Link from "next/link";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getOwnSlots } from "@/lib/data/slots";
import { formatSlotTimeRange } from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { cancelSlotAction } from "@/app/actions/slots";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "My availability" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  open: "default",
  full: "secondary",
  cancelled: "outline",
  completed: "outline",
};

export default async function AvailabilityPage() {
  const profile = await requireApprovedProfile();

  if (!hasRole(profile, "tutor")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My availability</CardTitle>
          <CardDescription>
            Only tutors can post availability slots. Ask an admin if you
            think you should have the tutor role.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createClient();
  const slots = await getOwnSlots(supabase, profile.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            My availability
          </h1>
          <p className="text-muted-foreground">
            Post time slots for tutees to book.
          </p>
        </div>
        <Link href="/availability/new" className={buttonVariants()}>
          Post a slot
        </Link>
      </div>

      {slots.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t posted any availability yet.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {slots.map((slot) => (
          <Card key={slot.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatSlotTimeRange(slot.starts_at, slot.ends_at)}
                  </span>
                  <Badge variant={STATUS_VARIANT[slot.status]}>
                    {slot.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {slot.location_name}
                  {slot.subject_name ? ` · ${slot.subject_name}` : ""} ·{" "}
                  {slot.reserved_count}/{slot.capacity} booked
                </p>
                {slot.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {slot.notes}
                  </p>
                )}
              </div>
              {(slot.status === "open" || slot.status === "full") && (
                <ActionButton
                  action={cancelSlotAction}
                  fields={{ slotId: slot.id }}
                  label="Cancel slot"
                  pendingLabel="Cancelling..."
                  variant="outline"
                  confirmMessage="Cancel this slot? Anyone who booked it will be un-booked."
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
