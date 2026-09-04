import Link from "next/link";
import {
  CalendarPlusIcon,
  CalendarSearchIcon,
  ClipboardListIcon,
  UsersIcon,
} from "lucide-react";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMyReservations, getOwnSlots } from "@/lib/data/slots";
import { listUsers } from "@/lib/data/admin";
import { formatSlotTimeRange, isUpcoming, byStartsAtAsc } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireApprovedProfile();
  const supabase = await createClient();
  const isTutor = hasRole(profile, "tutor");
  const isAdmin = hasRole(profile, "admin");

  const [reservations, ownSlots, pendingUsers] = await Promise.all([
    getMyReservations(supabase, profile.id),
    isTutor ? getOwnSlots(supabase, profile.id) : Promise.resolve([]),
    isAdmin ? listUsers(supabase, "pending") : Promise.resolve([]),
  ]);

  const upcomingBookings = reservations
    .filter(
      (r) =>
        r.status === "booked" &&
        r.slot_status !== "cancelled" &&
        isUpcoming(r.starts_at)
    )
    .sort(byStartsAtAsc);

  const upcomingOwnSlots = ownSlots
    .filter(
      (s) =>
        (s.status === "open" || s.status === "full") && isUpcoming(s.starts_at)
    )
    .sort(byStartsAtAsc);

  const quickLinks = [
    {
      href: "/calendar",
      label: "Find a session",
      description: "Browse open slots and book one.",
      icon: CalendarSearchIcon,
    },
    {
      href: "/my-bookings",
      label: "My bookings",
      description: "See and manage what you've booked.",
      icon: ClipboardListIcon,
    },
    ...(isTutor
      ? [
          {
            href: "/availability/new",
            label: "Post a slot",
            description: "Open a new time for tutees to book.",
            icon: CalendarPlusIcon,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: "/admin/users",
            label: "Manage users",
            description:
              pendingUsers.length > 0
                ? `${pendingUsers.length} account${pendingUsers.length === 1 ? "" : "s"} waiting for approval.`
                : "Approve accounts and grant roles.",
            icon: UsersIcon,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {profile.fullName.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          {upcomingBookings.length === 0 && upcomingOwnSlots.length === 0
            ? "Nothing on your schedule yet."
            : "Here's what's coming up."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full border-border/70 transition-colors hover:bg-accent/40">
              <CardContent className="flex flex-col gap-2 p-5">
                <span className="bg-spark flex size-8 items-center justify-center rounded-lg text-white">
                  <link.icon className="size-4" />
                </span>
                <p className="font-medium">{link.label}</p>
                <p className="text-sm text-muted-foreground">
                  {link.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Your upcoming sessions
        </h2>
        {upcomingBookings.length === 0 ? (
          <Card className="border-border/70">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm text-muted-foreground">
                You haven&apos;t booked anything yet.
              </p>
              <Link
                href="/calendar"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Browse the calendar
              </Link>
            </CardContent>
          </Card>
        ) : (
          upcomingBookings.slice(0, 5).map((r) => (
            <Card key={r.id} className="border-border/70">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-medium">
                    {formatSlotTimeRange(r.starts_at, r.ends_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {r.tutor_name} · {r.location_name}
                    {r.subject_name ? ` · ${r.subject_name}` : ""}
                  </p>
                </div>
                <Link
                  href="/my-bookings"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Manage
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {isTutor && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Your upcoming slots
            </h2>
            <Link
              href="/availability"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              All availability
            </Link>
          </div>
          {upcomingOwnSlots.length === 0 ? (
            <Card className="border-border/70">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t posted any upcoming availability.
                </p>
                <Link
                  href="/availability/new"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Post a slot
                </Link>
              </CardContent>
            </Card>
          ) : (
            upcomingOwnSlots.slice(0, 5).map((slot) => (
              <Card key={slot.id} className="border-border/70">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-medium">
                      {formatSlotTimeRange(slot.starts_at, slot.ends_at)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {slot.location_name}
                      {slot.subject_name ? ` · ${slot.subject_name}` : ""}
                    </p>
                  </div>
                  <Badge variant={slot.reserved_count > 0 ? "default" : "secondary"}>
                    {slot.reserved_count}/{slot.capacity} booked
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      )}

      {isAdmin && pendingUsers.length > 0 && (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>
              {pendingUsers.length} account
              {pendingUsers.length === 1 ? "" : "s"} awaiting approval
            </CardTitle>
            <CardDescription>
              New signups can&apos;t log in until an admin reviews them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/users" className={buttonVariants({ size: "sm" })}>
              Review now
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
