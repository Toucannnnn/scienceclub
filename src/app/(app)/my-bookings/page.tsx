import { requireApprovedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMyReservations } from "@/lib/data/slots";
import { formatSlotTimeRange } from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { cancelReservationAction, setSlotCapacityAction } from "@/app/actions/slots";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "My bookings" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  booked: "default",
  completed: "secondary",
  cancelled: "outline",
  no_show: "outline",
};

export default async function MyBookingsPage() {
  const profile = await requireApprovedProfile();
  const supabase = await createClient();
  const reservations = await getMyReservations(supabase, profile.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
        <p className="text-muted-foreground">
          Slots you&apos;ve reserved with a tutor.
        </p>
      </div>

      {reservations.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No bookings yet — find a slot on the calendar.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {reservations.map((r) => {
          const isActive = r.status === "booked" && r.slot_status !== "cancelled";
          const isLocked = r.capacity < r.max_capacity;
          const canManageCapacity = isActive && r.max_capacity > 1;

          return (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatSlotTimeRange(r.starts_at, r.ends_at)}
                    </span>
                    <Badge variant={STATUS_VARIANT[r.status]}>
                      {r.status === "no_show" ? "no show" : r.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.tutor_name} · {r.location_name}
                    {r.subject_name ? ` · ${r.subject_name}` : ""}
                  </p>
                  {canManageCapacity && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isLocked
                        ? "Reserved just for you."
                        : `Open to others (${r.reserved_count}/${r.capacity} booked).`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canManageCapacity && (
                    <ActionButton
                      action={setSlotCapacityAction}
                      fields={{
                        slotId: r.slot_id,
                        newCapacity: isLocked
                          ? String(r.max_capacity)
                          : String(r.reserved_count),
                      }}
                      label={
                        isLocked
                          ? "Reopen to others"
                          : r.reserved_count > 1
                            ? "Lock to just us"
                            : "Reserve just for me"
                      }
                      pendingLabel="Updating..."
                      variant="outline"
                    />
                  )}
                  {isActive && (
                    <ActionButton
                      action={cancelReservationAction}
                      fields={{ reservationId: r.id }}
                      label="Cancel"
                      pendingLabel="Cancelling..."
                      variant="outline"
                      confirmMessage="Cancel this booking?"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
