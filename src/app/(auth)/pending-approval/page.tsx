import { redirect } from "next/navigation";
import { requireAuthUser, getProfileWithRoles } from "@/lib/auth/dal";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Pending approval" };

export default async function PendingApprovalPage() {
  await requireAuthUser();
  const profile = await getProfileWithRoles();

  if (profile?.status === "approved") {
    redirect("/dashboard");
  }

  const rejected = profile?.status === "rejected";
  const suspended = profile?.status === "suspended";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {rejected
            ? "Account not approved"
            : suspended
              ? "Account suspended"
              : "Waiting on admin approval"}
        </CardTitle>
        <CardDescription>
          {rejected &&
            "A club admin reviewed your signup and didn't approve it. Reach out to an admin if you think this is a mistake."}
          {suspended &&
            "Your account has been suspended. Contact a club admin for details."}
          {!rejected &&
            !suspended &&
            "Your account is confirmed but still needs a club admin to review it and assign your role(s). This is usually quick — check back soon."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Signed in as {profile?.email}
        </p>
      </CardContent>
      <CardFooter>
        <form action={logout}>
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
