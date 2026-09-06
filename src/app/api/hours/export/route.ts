import { createClient } from "@/lib/supabase/server";
import { getMyHours } from "@/lib/data/hours";
import { toCsv, csvDateStamp } from "@/lib/csv";

/**
 * A tutor downloads their own hours.
 *
 * A Route Handler rather than a Server Action: this streams a real file with
 * a real filename via Content-Disposition, and works without JavaScript. A
 * Server Action returning a string would force a client-side Blob dance.
 *
 * Authorization is RLS — get_my_hours() is scoped to auth.uid(), and this
 * uses the ordinary cookie-backed client, never the service-role key. There
 * is deliberately no tutorId parameter to tamper with.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Not signed in", { status: 401 });
  }

  const rows = await getMyHours(supabase);
  const approved = rows
    .filter((row) => row.status === "approved")
    .reduce((sum, row) => sum + row.hours, 0);

  const csv = toCsv(
    ["Date", "Course", "Format", "Attendees", "Hours", "Status", "Submitted", "Reviewed", "Note"],
    [
      ...rows.map((row) => [
        row.sessionDate,
        row.courseName ?? "",
        row.helpMode,
        row.attendees,
        row.hours.toFixed(2),
        row.status,
        row.submittedAt.slice(0, 10),
        row.reviewedAt?.slice(0, 10) ?? "",
        row.reviewNote ?? "",
      ]),
      [],
      ["", "", "", "Approved total", approved.toFixed(2), "", "", "", ""],
    ]
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tutoring-hours-${csvDateStamp()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
