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

export const metadata = { title: "Sessions" };

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "full", label: "Full" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const ORIGIN_FILTERS = [
  { value: "all", label: "Any origin" },
  { value: "posted", label: "Posted by tutor" },
  { value: "request", label: "From a request" },
];

const SORTS = [
  { value: "session_date", label: "Date" },
  { value: "tutor", label: "Tutor" },
  { value: "course", label: "Course" },
  { value: "status", label: "Status" },
];

type SessionRow = {
  id: string;
  session_date: string;
  status: string;
  tutor_name: string;
  course_name: string | null;
  location_name: string | null;
  help_mode: string;
  capacity_mode: string;
  capacity: number;
  booked: number;
  from_request: boolean;
  hours_status: string | null;
};

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    origin?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const params = await searchParams;
  const status = STATUS_FILTERS.some((f) => f.value === params.status)
    ? params.status!
    : "all";
  const origin = ORIGIN_FILTERS.some((f) => f.value === params.origin)
    ? params.origin!
    : "all";
  const sort = SORTS.some((s) => s.value === params.sort)
    ? params.sort!
    : "session_date";
  const desc = params.dir !== "asc";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_sessions", {
    p_status: status,
    p_origin: origin,
    p_sort: sort,
    p_desc: desc,
  });
  if (error) throw error;
  const rows = (data ?? []) as SessionRow[];

  // Sorting lives in the URL, not client state: React Compiler treats an
  // un-memoized client sort as a lint error, and this stays shareable.
  const linkFor = (next: Record<string, string>) => {
    const merged = new URLSearchParams({ status, origin, sort, dir: desc ? "desc" : "asc", ...next });
    return `/admin/sessions?${merged.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
        <p className="text-muted-foreground">
          Every session ever posted or claimed. {rows.length} shown.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={linkFor({ status: filter.value })}
              className={buttonVariants({
                size: "sm",
                variant: status === filter.value ? "secondary" : "ghost",
                className: "rounded-full",
              })}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ORIGIN_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={linkFor({ origin: filter.value })}
              className={buttonVariants({
                size: "sm",
                variant: origin === filter.value ? "secondary" : "ghost",
                className: "rounded-full",
              })}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {SORTS.map((column) => (
                    <TableHead key={column.value}>
                      <Link
                        href={linkFor({
                          sort: column.value,
                          dir: sort === column.value && desc ? "asc" : "desc",
                        })}
                        className="hover:underline"
                      >
                        {column.label}
                        {sort === column.value ? (desc ? " ↓" : " ↑") : ""}
                      </Link>
                    </TableHead>
                  ))}
                  <TableHead>Booked</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Nothing matches those filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {formatSessionDate(row.session_date)}
                    </TableCell>
                    <TableCell>{row.tutor_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.course_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "cancelled" ? "outline" : "secondary"}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.booked}
                      {row.capacity_mode === "unlimited"
                        ? " / ∞"
                        : ` / ${row.capacity}`}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.from_request ? "Request" : "Posted"}
                    </TableCell>
                    <TableCell>
                      {row.hours_status ? (
                        <Badge
                          variant={
                            row.hours_status === "approved" ? "default" : "secondary"
                          }
                        >
                          {row.hours_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
