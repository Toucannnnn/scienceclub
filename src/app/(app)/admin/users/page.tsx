import { createClient } from "@/lib/supabase/server";
import { listUsers } from "@/lib/data/admin";
import { ApproveUserForm } from "./approve-user-form";
import { RoleToggles } from "./role-toggles";
import { Badge } from "@/components/ui/badge";
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

export const metadata = { title: "Manage users" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  suspended: "outline",
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const users = await listUsers(supabase);
  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Manage users
        </h1>
        <p className="text-muted-foreground">
          Approve new signups, assign roles, and manage everyone else&apos;s.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending approval ({pending.length})</CardTitle>
          <CardDescription>
            Checkboxes default to what they requested at signup — adjust
            before approving if needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No pending accounts.
            </p>
          )}
          {pending.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{u.fullName}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </div>
              <ApproveUserForm userId={u.id} requestedRoles={u.requestedRoles} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Everyone else</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {others.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[u.status]}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.status === "approved" ? (
                        <RoleToggles userId={u.id} grantedRoles={u.grantedRoles} />
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
