import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Tutor roster" };

type RosterRow = {
  tutor_id: string;
  tutor_name: string;
  tutor_email: string;
  status: string;
  approved_courses: string[];
  pending_courses: number;
  sessions_held: number;
  approved_hours: number;
  pending_hours: number;
};

export default async function AdminTutorsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_tutor_roster");
  if (error) throw error;
  const rows = (data ?? []) as RosterRow[];

  const totalHours = rows.reduce(
    (sum, row) => sum + Number(row.approved_hours),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tutor roster</h1>
        <p className="text-muted-foreground">
          {rows.length} tutor{rows.length === 1 ? "" : "s"} ·{" "}
          {totalHours.toFixed(1)} approved volunteer hours between them.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Approved to tutor</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Approved hours</TableHead>
                  <TableHead>Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No tutors yet.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.tutor_id}>
                    <TableCell>
                      <Link
                        href={`/admin/tutors/${row.tutor_id}`}
                        className="font-medium hover:underline"
                      >
                        {row.tutor_name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {row.tutor_email}
                      </span>
                      {row.status !== "approved" && (
                        <Badge variant="outline" className="mt-1">
                          {row.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.approved_courses.length === 0 ? (
                        <span className="text-muted-foreground">
                          Nothing yet
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {row.approved_courses.map((course) => (
                            <Badge key={course} variant="secondary">
                              {course}
                            </Badge>
                          ))}
                        </span>
                      )}
                      {row.pending_courses > 0 && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {row.pending_courses} awaiting approval
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.sessions_held}
                    </TableCell>
                    <TableCell className="font-medium">
                      {Number(row.approved_hours).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {Number(row.pending_hours).toFixed(2)}
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
