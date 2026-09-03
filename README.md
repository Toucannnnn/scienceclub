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
- [ ] **Phase 2 — Notifications**
- [ ] **Phase 3 — Hours: confirmation, auto-logging, approval**
- [ ] **Phase 4 — No-show & cancellation enforcement**
- [ ] **Phase 5 — Full admin toolkit, reporting, polish**

## Structure

- `src/app/(auth)` — public auth pages (login, signup, pending-approval).
- `src/app/(app)` — authenticated, approved-user pages (role-aware).
- `src/app/actions` — Server Actions (form mutations).
- `src/lib/auth/dal.ts` — the one place session/role checks happen.
- `src/lib/supabase` — Supabase client setup (browser, server, proxy).
- `supabase/migrations` — database schema, applied with `supabase db push`.
