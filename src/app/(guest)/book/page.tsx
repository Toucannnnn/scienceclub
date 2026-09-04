import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPublicOpenSlots } from "@/lib/data/public-slots";
import { formatSlotTimeRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Book a session" };

export default async function GuestBookPage() {
  // The guest RPCs are granted to `anon` only, deliberately — an
  // already-signed-in visitor (even one still pending approval) should use
  // the real calendar, not this path, so send them there instead of
  // letting them hit a raw "permission denied" from the database.
  const user = await getAuthUser();
  if (user) redirect("/calendar");

  const supabase = await createClient();
  const slots = await getPublicOpenSlots(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Book a session
        </h1>
        <p className="text-muted-foreground">
          Pick an open slot below — you&apos;ll just need your name and
          email, no account required.
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
                <Link href={`/book/${slot.id}`} className={buttonVariants()}>
                  Book
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
