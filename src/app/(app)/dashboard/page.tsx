import { getProfileWithRoles } from "@/lib/auth/dal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await getProfileWithRoles();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {profile?.fullName.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          The booking calendar, availability tools, and admin console arrive
          in the next phase of the build.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>{profile?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Roles:{" "}
            {profile?.roles.length
              ? profile.roles.join(", ")
              : "none assigned yet"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
