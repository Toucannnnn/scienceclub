# Science Peer Tutoring — Assigning System

Scheduling, booking, and hour-tracking system for a science peer tutoring
club. Tutors post availability, tutees book time slots off a calendar,
and admins moderate accounts, approve hours, and enforce a no-show/
cancellation policy.

Built with Next.js (App Router) + Tailwind + shadcn/ui, backed by Supabase
(Postgres, Auth, Row Level Security).

## Getting started

See [`SETUP.md`](./SETUP.md) for creating a Supabase project, applying the
database schema, and running the app locally.

## Project status

Being built in phases — see the architecture and phase plan this was built
from for the full roadmap (schema, security model, and what ships in each
phase).

- [x] **Phase 0 — Scaffolding**: auth (signup/login/logout), admin-approval
      gate, role model (tutor/tutee/admin, additive), base UI shell.
- [x] **Phase 1 — MVP booking loop**: tutor availability, tutee calendar +
      reservations (race-safe, capacity lock/reopen), admin user approval UI.
- [x] **Phase 2 — Notifications**: in-app bell + read state, transactional
      emails (booking confirmed/cancelled, slot cancelled, account approved)
      and ~1hr-out session reminders, via an outbox drained by a scheduled
      Route Handler.
- [ ] **Phase 3 — Hours: confirmation, auto-logging, approval**
- [ ] **Phase 4 — No-show & cancellation enforcement**
- [ ] **Phase 5 — Full admin toolkit, reporting, polish**
- [x] **Guest booking** (cross-cutting addition, not a numbered phase):
      tutees can book with just a name + email — no account, no admin
      approval. No login, ever; a tutee manages/cancels their booking via a
      private link (a secret token) emailed to them instead. Tutors see a
      guest's name and email alongside every regular booking on their
      slots. Tutors/admins still sign up and get approved as before —
      this only adds an alternate path for tutees. See `/book`.

## Structure

- `src/app/(auth)` — public auth pages (login, signup, pending-approval).
- `src/app/(app)` — authenticated, approved-user pages (role-aware).
- `src/app/actions` — Server Actions (form mutations).
- `src/app/api/cron/dispatch-notifications` — scheduled Route Handler that
  enqueues due session reminders and drains the email outbox (see SETUP.md).
- `src/lib/auth/dal.ts` — the one place session/role checks happen.
- `src/lib/supabase` — Supabase client setup (browser, server, proxy, admin).
- `supabase/migrations` — database schema, applied with `supabase db push`.
