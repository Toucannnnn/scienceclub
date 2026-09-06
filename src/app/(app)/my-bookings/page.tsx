import { requireApprovedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMyReservations } from "@/lib/data/slots";
import { getMyRequests } from "@/lib/data/requests";
import {
  clubToday,
  formatSessionDate,
  formatSlotTimeRange,
  SESSION_TIME_LABEL,
} from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { AddToCalendar } from "@/components/add-to-calendar";
import { cancelReservationAction, setSlotCapacityAction } from "@/app/actions/slots";
import { cancelRequestAction } from "@/app/actions/requests";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Tutee bookings" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  booked: "default",
  completed: "secondary",
  cancelled: "outline",
  no_show: "outline",
};

const REQUEST_STATUS_LABEL: Record<string, string> = {
  open: "Waiting for a tutor",
  claimed: "A tutor is coming",
  unclaimed: "Nobody claimed it",
};

const REQUEST_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> =
  {
    open: "secondary",
    claimed: "default",
    unclaimed: "outline",
  };

export default async function MyBookingsPage() {
  const profile = await requireApprovedProfile();
  const supabase = await createClient();
  const [reservations, requests] = await Promise.all([
    getMyReservations(supabase, profile.id),
    getMyRequests(supabase, profile.id, clubToday()),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tutee bookings
        </h1>
        <p className="text-muted-foreground">
          Sessions you&apos;ve booked, and tutors you&apos;ve asked for.
        </p>
      </div>

      {requests.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Your requests
          </h2>
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {formatSessionDate(request.sessionDate)}
                    </span>
                    <Badge
                      variant={REQUEST_STATUS_VARIANT[request.status] ?? "outline"}
                    >
                      {REQUEST_STATUS_LABEL[request.status] ?? request.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {request.courseName} · {SESSION_TIME_LABEL}
                    {request.tutorName ? ` · ${request.tutorName}` : ""}
                  </p>
                  {request.status === "unclaimed" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Go straight to your teacher&apos;s room at 12:15 —
                      they&apos;re hosting that day either way.
                    </p>
                  )}
                </div>
                <ActionButton
                  action={cancelRequestAction}
                  fields={{ requestId: request.id }}
                  label="Cancel"
                  pendingLabel="Cancelling..."
                  variant="outline"
                  confirmMessage="Cancel this request?"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reservations.length === 0 && requests.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing yet — book a session on the calendar, or ask for a tutor on
          any day tutoring runs.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {reservations.length > 0 && requests.length > 0 && (
          <h2 className="text-sm font-medium text-muted-foreground">
            Your booked sessions
          </h2>
        )}
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
                <div className="flex flex-wrap items-center gap-2">
                  {isActive && (
                    <AddToCalendar
                      startsAt={r.starts_at}
                      endsAt={r.ends_at}
                      tutorName={r.tutor_name}
                      courseName={r.subject_name}
                      locationName={r.location_name}
                      slotId={r.slot_id}
                    />
                  )}
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
