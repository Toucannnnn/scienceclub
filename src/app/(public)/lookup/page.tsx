import { LookupForm } from "./lookup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Find my bookings" };

export default function LookupPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Find my bookings</CardTitle>
          <CardDescription>
            Booked without an account? Put in the email you used and we&apos;ll
            find your sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LookupForm />
        </CardContent>
      </Card>
    </div>
  );
}
