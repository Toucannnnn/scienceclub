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
