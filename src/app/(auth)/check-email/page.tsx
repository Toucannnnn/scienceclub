import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a confirmation link to the email address you signed up
          with. Click it, then log in — an admin will still need to approve
          your account before you can use the site.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get an email? Check your spam folder, or contact a club
          admin.
        </p>
      </CardContent>
    </Card>
  );
}
