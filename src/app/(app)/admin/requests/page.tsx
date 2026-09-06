import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatSessionDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Requests" };

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "claimed", label: "Claimed" },
  { value: "unclaimed", label: "Went unclaimed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  open: "secondary",
  claimed: "default",
  unclaimed: "outline",
  cancelled: "outline",
};

type RequestRow = {
  id: string;
  session_date: string;
  status: string;
  course_name: string;
  requester_name: string | null;
  requester_email: string | null;
  tutor_name: string | null;
  note: string | null;
};

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = FILTERS.some((f) => f.value === status) ? status! : "open";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_requests", {
    p_status: active,
  });
  if (error) throw error;
  const rows = (data ?? []) as RequestRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tutor requests
        </h1>
        <p className="text-muted-foreground">
          Tickets tutees posted. &ldquo;Went unclaimed&rdquo; means nobody
          signed up before noon — those stay on the calendar and a tutor can
          still claim one after the fact.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/requests?status=${filter.value}`}
            className={buttonVariants({
              size: "sm",
              variant: active === filter.value ? "secondary" : "ghost",
              className: "rounded-full",
            })}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tutor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Nothing here.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {formatSessionDate(row.session_date)}
                    </TableCell>
                    <TableCell>{row.course_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.requester_name ?? "—"}
                      {row.requester_email && (
                        <span className="block text-xs">
                          {row.requester_email}
                        </span>
                      )}
                      {row.note && (
                        <span className="block text-xs italic">
                          &ldquo;{row.note}&rdquo;
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.tutor_name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
