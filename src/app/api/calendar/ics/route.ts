import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";

/**
 * Downloads one session as a .ics file.
 *
 * Two ways in, matching the two ways someone can hold a booking:
 *
 *   ?slot=<id>                    signed-in members — RLS decides
 *   ?reservation=<id>&t=<token>   guests — the same token that manages the
 *                                 booking, via the existing definer RPC
 *
 * Nothing here widens access: a signed-out caller with neither a session
 * nor a valid token gets nothing.
 */
export async function GET(request: NextRequest) {
  const slotId = request.nextUrl.searchParams.get("slot");
  const reservationId = request.nextUrl.searchParams.get("reservation");
  const token = request.nextUrl.searchParams.get("t");

  const supabase = await createClient();

  let startsAt: string | undefined;
  let endsAt: string | undefined;
  let tutorName = "your tutor";
  let courseName: string | null = null;
  let locationName: string | null = null;
  let uid = slotId ?? reservationId ?? "";

  if (reservationId && token) {
    const { data, error } = await supabase.rpc("get_guest_reservation", {
      p_reservation_id: reservationId,
      p_token: token,
    });
    const row = data?.[0];
    if (error || !row) {
      return new Response("Not found", { status: 404 });
    }
    startsAt = row.starts_at;
    endsAt = row.ends_at;
    tutorName = row.tutor_name ?? tutorName;
    courseName = row.subject_name ?? null;
    locationName = row.location_name ?? null;
    uid = reservationId;
  } else if (slotId) {
    // RLS is the gate: availability_slots is readable by approved members,
    // so a signed-out caller gets nothing back here.
    const { data, error } = await supabase
      .from("availability_slots")
      .select(
        `starts_at, ends_at,
         tutor:profiles!availability_slots_tutor_id_fkey(full_name),
         course:courses(name), location:locations(name)`
      )
      .eq("id", slotId)
      .maybeSingle();

    if (error || !data) {
      return new Response("Not found", { status: 404 });
    }
    startsAt = data.starts_at;
    endsAt = data.ends_at;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    tutorName = row.tutor?.full_name ?? tutorName;
    courseName = row.course?.name ?? null;
    locationName = row.location?.name ?? null;
  } else {
    return new Response("Missing slot or reservation", { status: 400 });
  }

  if (!startsAt || !endsAt) {
    return new Response("Not found", { status: 404 });
  }

  const summary = courseName
    ? `${courseName} tutoring with ${tutorName}`
    : `Tutoring with ${tutorName}`;

  const ics = buildIcs({
    uid: `${uid}@scienceallstars`,
    start: new Date(startsAt),
    end: new Date(endsAt),
    summary,
    description: "Science All Stars peer tutoring session.",
    location: locationName ?? undefined,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tutoring-session.ics"',
      "Cache-Control": "no-store",
    },
  });
}
