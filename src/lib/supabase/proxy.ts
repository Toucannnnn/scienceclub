import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and performs an
 * optimistic redirect for unauthenticated users hitting a protected route.
 * This is NOT the only auth check — every Server Component/Action still
 * verifies the session itself (see src/lib/auth/dal.ts) — this just keeps
 * the session cookie alive and avoids an unnecessary render for logged-out
 * users. Called from src/proxy.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Route Handlers authenticate themselves and must never be bounced to an
  // HTML login page — a cron scheduler or a guest with a token can't follow
  // one. This was silently breaking the whole notification system: the cron
  // dispatcher got a 307 to /login, so reminders never sent, the noon
  // unclaimed sweep never ran, and email_outbox never drained.
  //
  // Each handler does its own check: /api/cron uses CRON_SECRET,
  // /api/hours/export requires a session, /api/calendar/ics relies on RLS
  // or a guest token.
  if (path.startsWith("/api/")) {
    return response;
  }

  const publicPaths = ["/login", "/signup", "/"];
  // The calendar, the booking flow under "/book" (per-slot booking, the
  // token-gated manage page) and the request flow under "/request" (asking for
  // a tutor on a date, and the token-gated manage page migration 0011's emails
  // link to) are deliberately reachable with no session — browsing, booking
  // and asking never require an account. Everything else does.
  const publicPrefixes = ["/calendar", "/book", "/lookup", "/request"];
  const isPublicPath =
    publicPaths.includes(path) ||
    publicPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (!user && !isPublicPath) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
