import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// How many outbox rows to send per invocation. Keep well under any
// provider rate limit — the dispatcher just runs again next cycle if more
// are left pending.
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;

type OutboxRow = {
  id: string;
  to_email: string;
  subject: string;
  body_html: string;
  link: string | null;
  attempts: number;
};

function wrapEmailHtml(bodyHtml: string, ctaHref: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f0f4f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#202124;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;background:linear-gradient(100deg,#4285f4,#9b72cb 45%,#d96570);color:#ffffff;font-weight:600;font-size:16px;">
          Science All Stars
        </td>
      </tr>
      <tr>
        <td style="padding:24px;font-size:14px;line-height:1.6;">
          ${bodyHtml}
          <p style="margin-top:24px;">
            <a href="${ctaHref}" style="display:inline-block;padding:10px 20px;background:#1a73e8;color:#ffffff;border-radius:999px;text-decoration:none;font-size:14px;font-weight:500;">
              Open Science All Stars
            </a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

async function dispatch(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );

  const { data: reminderCount, error: reminderError } = await supabase.rpc(
    "enqueue_due_reminders"
  );
  if (reminderError) {
    return NextResponse.json(
      { error: `enqueue_due_reminders failed: ${reminderError.message}` },
      { status: 500 }
    );
  }

  const { data: pending, error: selectError } = await supabase
    .from("email_outbox")
    .select("id, to_email, subject, body_html, link, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (selectError) {
    return NextResponse.json(
      { error: `reading email_outbox failed: ${selectError.message}` },
      { status: 500 }
    );
  }

  const rows = (pending ?? []) as OutboxRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const ctaHref = row.link ? `${siteUrl}${row.link}` : siteUrl;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [row.to_email],
          subject: row.subject,
          html: wrapEmailHtml(row.body_html, ctaHref),
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
      }

      await supabase
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const lastError = err instanceof Error ? err.message : String(err);
      await supabase
        .from("email_outbox")
        .update({
          attempts,
          last_error: lastError,
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return NextResponse.json({
    remindersEnqueued: reminderCount ?? 0,
    processed: rows.length,
    sent,
    failed,
  });
}

export async function GET(request: NextRequest) {
  return dispatch(request);
}

export async function POST(request: NextRequest) {
  return dispatch(request);
}
