import { requireApprovedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getOpenSlots } from "@/lib/data/slots";
import { formatSlotTimeRange } from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { reserveSlotAction } from "@/app/actions/slots";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const profile = await requireApprovedProfile();
  const supabase = await createClient();
  const slots = await getOpenSlots(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">
          Open tutoring slots. Book one to reserve your spot.
        </p>
      </div>

      {slots.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No open slots right now — check back later.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {slots.map((slot) => {
          const spotsLeft = slot.capacity - slot.reserved_count;
          const isOwnSlot = slot.tutor_id === profile.id;
          return (
            <Card key={slot.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatSlotTimeRange(slot.starts_at, slot.ends_at)}
                    </span>
                    {slot.max_capacity > 1 && (
                      <Badge variant="secondary">
                        {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {slot.tutor_name} · {slot.location_name}
                    {slot.subject_name ? ` · ${slot.subject_name}` : ""}
                  </p>
                  {slot.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {slot.notes}
                    </p>
                  )}
                </div>
                {!isOwnSlot && (
                  <ActionButton
                    action={reserveSlotAction}
                    fields={{ slotId: slot.id }}
                    label="Reserve"
                    pendingLabel="Reserving..."
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
