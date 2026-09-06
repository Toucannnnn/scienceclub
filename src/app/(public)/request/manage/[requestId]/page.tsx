import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatSessionDate, SESSION_TIME_LABEL } from "@/lib/format";
import { cancelGuestRequestAction } from "@/app/actions/requests";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Your tutor request" };

const STATUS_LABEL: Record<string, string> = {
  open: "Waiting for a tutor",
  claimed: "A tutor is coming",
  unclaimed: "Nobody claimed it",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  open: "secondary",
  claimed: "default",
  unclaimed: "outline",
  cancelled: "outline",
};

// Doubles as the confirmation screen a guest lands on right after asking and
// the page they come back to from the emailed link — same as the guest
// booking manage page, and the route migration 0011's emails already point at.
export default async function GuestManageRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { requestId } = await params;
  const { t: token } = await searchParams;

  const supabase = await createClient();
  const { data, error } = token
    ? await supabase.rpc("get_request_for_guest", {
        p_request_id: requestId,
        p_token: token,
      })
    : { data: null, error: null };

  const request = data?.[0];

  if (error || !request) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>This request link isn&apos;t valid</CardTitle>
          <CardDescription>
            Check you copied the whole link from your email. If you think this
            is a mistake, ask an admin for help.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isActive = request.status === "open" || request.status === "claimed";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{formatSessionDate(request.session_date)}</CardTitle>
            <Badge variant={STATUS_VARIANT[request.status] ?? "outline"}>
              {STATUS_LABEL[request.status] ?? request.status}
            </Badge>
          </div>
          <CardDescription>
            {request.course_name} · {SESSION_TIME_LABEL}
            {request.teacher_name ? ` · ${request.teacher_name}'s room` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {request.status === "claimed" && request.tutor_name && (
            <p>
              <strong>{request.tutor_name}</strong> claimed your request — go to{" "}
              {request.teacher_name
                ? `${request.teacher_name}'s room`
                : "your teacher's room"}{" "}
              at 12:15.
            </p>
          )}

          {request.status === "unclaimed" && (
            <p className="text-muted-foreground">
              No tutor was able to take this one. You can still go straight to{" "}
              {request.teacher_name
                ? `${request.teacher_name}'s room`
                : "your teacher's room"}{" "}
              at 12:15 — they&apos;re hosting that day either way.
            </p>
          )}

          {request.note && (
            <p className="text-muted-foreground">
              Your note: &ldquo;{request.note}&rdquo;
            </p>
          )}

          <p className="text-muted-foreground">
            Asked under {request.guest_name}. Bookmark this page or keep your
            email — it&apos;s the only way to manage this request.
          </p>

          {isActive && (
            <ActionButton
              action={cancelGuestRequestAction}
              fields={{ requestId, token: token ?? "" }}
              label="Cancel this request"
              pendingLabel="Cancelling..."
              variant="outline"
              confirmMessage="Cancel this request?"
            />
          )}
        </CardContent>
      </Card>

      <Link
        href="/calendar"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <CalendarDaysIcon className="size-4" /> Back to the calendar
      </Link>
    </div>
  );
}
