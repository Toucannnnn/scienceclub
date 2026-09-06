import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getHoursForReview, type HoursStatus } from "@/lib/data/hours";
import { formatSessionDate } from "@/lib/format";
import { HoursDecisionForm } from "./hours-decision-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Hour verification" };

const FILTERS: { value: HoursStatus | "all"; label: string }[] = [
  { value: "submitted", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Sent back" },
  { value: "all", label: "All" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  approved: "default",
  submitted: "secondary",
  rejected: "outline",
};

export default async function AdminHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = (FILTERS.find((f) => f.value === status)?.value ??
    "submitted") as HoursStatus | "all";

  const supabase = await createClient();
  const rows = await getHoursForReview(supabase, active);

  // Proof photos live in a private bucket, so each one needs a short-lived
  // signed URL. Ten minutes is plenty to review a queue.
  const proofUrls = new Map<string, string>();
  await Promise.all(
    rows
      .filter((row) => row.proofObjectPath)
      .map(async (row) => {
        const { data } = await supabase.storage
          .from("session-proofs")
          .createSignedUrl(row.proofObjectPath!, 600);
        if (data?.signedUrl) proofUrls.set(row.id, data.signedUrl);
      })
  );

  const approvedTotal = rows
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + r.hours, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hour verification
        </h1>
        <p className="text-muted-foreground">
          Check the proof, then approve or send it back. You can adjust the
          hours before approving.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/hours?status=${filter.value}`}
            className={buttonVariants({
              size: "sm",
              variant: active === filter.value ? "secondary" : "ghost",
              className: "rounded-full",
            })}
          >
            {filter.label}
          </Link>
        ))}
        <Link
          href="/admin/users"
          className={buttonVariants({ size: "sm", variant: "outline", className: "ml-auto" })}
        >
          Administration
        </Link>
      </div>

      {active === "approved" && rows.length > 0 && (
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Total approved volunteer hours
            </p>
            <p className="mt-1 text-3xl font-semibold">
              {approvedTotal.toFixed(1)}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {FILTERS.find((f) => f.value === active)?.label} ({rows.length})
          </CardTitle>
          <CardDescription>
            Every session is half an hour unless a tutor ran long.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing here.</p>
          )}
          {rows.map((row) => {
            const proofUrl = proofUrls.get(row.id);
            return (
              <div
                key={row.id}
                className="flex flex-col gap-3 border-b pb-6 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {row.tutorName}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {row.courseName ?? "Session"} ·{" "}
                        {formatSessionDate(row.sessionDate)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.tutorEmail} · {row.hours.toFixed(2)} hours
                    </p>
                    {row.tutorNote && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        &ldquo;{row.tutorNote}&rdquo;
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_VARIANT[row.status]}>
                    {row.status}
                  </Badge>
                </div>

                {proofUrl ? (
                  <a href={proofUrl} target="_blank" rel="noreferrer">
                    <Image
                      src={proofUrl}
                      alt={`Proof submitted by ${row.tutorName}`}
                      width={320}
                      height={240}
                      unoptimized
                      className="max-h-60 w-auto rounded-xl border object-contain"
                    />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No photo attached.
                  </p>
                )}

                {row.status === "submitted" && (
                  <HoursDecisionForm hoursId={row.id} defaultHours={row.hours} />
                )}
                {row.reviewNote && row.status !== "submitted" && (
                  <p className="text-sm text-muted-foreground">
                    Note: {row.reviewNote}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
