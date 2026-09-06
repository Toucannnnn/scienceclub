import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMyHours } from "@/lib/data/hours";
import { formatSessionDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "My hours" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  approved: "default",
  submitted: "secondary",
  rejected: "outline",
};

export default async function HoursPage() {
  const profile = await requireApprovedProfile();

  if (!hasRole(profile, "tutor")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My hours</CardTitle>
          <CardDescription>
            Volunteer hours are tracked for tutors.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createClient();
  const rows = await getMyHours(supabase);

  const approved = rows
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + r.hours, 0);
  const pending = rows
    .filter((r) => r.status === "submitted")
    .reduce((sum, r) => sum + r.hours, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My hours</h1>
          <p className="text-muted-foreground">
            Sessions you&apos;ve logged, and where they stand.
          </p>
        </div>
        {rows.length > 0 && (
          <a href="/api/hours/export" className={buttonVariants({ variant: "outline" })}>
            <DownloadIcon />
            Export CSV
          </a>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="mt-1 text-3xl font-semibold">{approved.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">hours</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Waiting on review</p>
            <p className="mt-1 text-3xl font-semibold">{pending.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">hours</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Every session you&apos;ve logged</CardTitle>
          <CardDescription>
            Log a session from{" "}
            <Link href="/availability" className="underline underline-offset-4">
              Tutor availability
            </Link>
            , any time after it starts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Attendees</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {formatSessionDate(row.sessionDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.courseName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.attendees}
                      </TableCell>
                      <TableCell>{row.hours.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {row.status}
                        </Badge>
                        {row.reviewNote && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.reviewNote}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
