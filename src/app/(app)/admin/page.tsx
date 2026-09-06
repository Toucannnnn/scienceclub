import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Administration" };

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) throw error;

  const o = data?.[0] ?? {};

  const queues = [
    {
      href: "/admin/users",
      label: "Accounts awaiting approval",
      value: o.pending_users ?? 0,
    },
    {
      href: "/admin/users",
      label: "Course approvals waiting",
      value: o.pending_courses ?? 0,
    },
    {
      href: "/admin/hours",
      label: "Hours to verify",
      value: o.pending_hours ?? 0,
    },
    {
      href: "/admin/requests?status=open",
      label: "Open tutor requests",
      value: o.open_requests ?? 0,
    },
    {
      href: "/admin/requests?status=unclaimed",
      label: "Went unclaimed",
      value: o.unclaimed_requests ?? 0,
    },
    {
      href: "/admin/sessions",
      label: "Upcoming sessions",
      value: o.upcoming_sessions ?? 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Administration
        </h1>
        <p className="text-muted-foreground">
          Anything with a number next to it is waiting on you.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {queues.map((queue) => (
          <Link key={queue.label} href={queue.href}>
            <Card
              className={`h-full transition-colors hover:bg-accent/40 ${
                queue.value > 0 ? "border-primary/40" : "border-border/70"
              }`}
            >
              <CardContent className="p-5">
                <p className="text-3xl font-semibold">{queue.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {queue.label}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border/70">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            Total approved volunteer hours, all tutors
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {Number(o.approved_hours ?? 0).toFixed(1)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
