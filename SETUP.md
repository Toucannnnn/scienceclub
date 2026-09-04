# Setup

## 1. Create a Supabase project

1. Go to https://supabase.com/dashboard and sign in (or create an account).
2. Create a new project. Pick any name/region; note the database password
   somewhere safe (you likely won't need it directly, Supabase manages
   connections for you).
3. Once it's provisioned, go to **Project Settings -> API** and copy:
   - **Project URL**
   - **anon / public** key
4. Copy `.env.local.example` to `.env.local` in this folder and paste those
   two values in.

## 2. Apply the database schema

With the Supabase CLI (already used to scaffold `supabase/`):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # ref is in your project URL
npx supabase db push                                  # applies supabase/migrations/*.sql
```

`db push` applies every migration in `supabase/migrations/` to your live
project. Re-run it after any new migration file is added.

## 3. Turn off email confirmation (optional, for faster local testing)

By default Supabase requires confirming a new signup's email before it can
log in. That's fine for real use, but if you want to test signup instantly
without wiring up email delivery yet: **Authentication -> Providers -> Email**
in the dashboard, toggle "Confirm email" off. Turn it back on before real
users start signing up.

## 4. Create the first admin

There's no UI for this yet (Phase 1 adds one) — after someone signs up,
approve them and grant the `admin` role directly in the Supabase dashboard's
**Table Editor**:

1. `profiles` table -> find their row -> set `status` to `approved`.
2. `user_roles` table -> insert a row: `user_id` = their id (from `profiles`),
   `role_code` = `admin`.

They can then use the (future) admin UI to approve everyone else normally.

## 5. Run the app

```bash
npm run dev
```

Visit http://localhost:3000.

## 6. Notifications (Phase 2)

In-app notifications work with no extra setup. Emails need a bit more:

1. Create a free [Resend](https://resend.com) account, verify a sending
   domain (or use `onboarding@resend.dev` for local testing without a
   verified domain), and grab an API key from **API Keys**.
2. In your Supabase dashboard: **Project Settings -> API -> service_role**
   — copy that key too. Treat it like a root password: it bypasses every
   RLS policy in the database.
3. Add to `.env.local` (see `.env.local.example` for the full list):
   `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
   `CRON_SECRET` (any random string — `openssl rand -hex 32`), and
   `NEXT_PUBLIC_SITE_URL`.

That covers emails triggered by an action someone takes in the app (booking,
cancelling, admin approval) — those send as soon as the action runs. Session
*reminders* and actually draining the send queue both need something to hit
`/api/cron/dispatch-notifications` on a schedule, since nothing inside
Postgres talks to the internet. Pick one:

- **Vercel Cron** (if deploying there): add a `vercel.json` with a cron job
  hitting that path every 10 minutes, and set the request's `Authorization`
  header to `Bearer <CRON_SECRET>` (Vercel Cron can't set custom headers
  itself — pass the secret as `?secret=<CRON_SECRET>` in the cron path
  instead).
- **A free external scheduler** (e.g. [cron-job.org](https://cron-job.org)):
  point it at `https://your-domain/api/cron/dispatch-notifications` every
  ~10 minutes with header `Authorization: Bearer <CRON_SECRET>`.
- **Local testing**: call it yourself —
  ```bash
  curl -X POST "http://localhost:3000/api/cron/dispatch-notifications?secret=<CRON_SECRET>"
  ```

A ~10 minute cadence matters for reminders specifically: `enqueue_due_reminders()`
only catches sessions starting 55–65 minutes out, so a much slower cron
cadence can skip that window entirely. Booking/cancellation/approval emails
aren't time-sensitive the same way — they just wait in the queue until the
next run.
