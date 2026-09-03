-- Phase 0: identity, roles, and reference data.
-- Establishes the profile/role model every later migration builds on:
-- roles are additive (a user can be tutor + tutee + admin at once), and new
-- accounts start unapproved until an admin reviews them.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto"; -- gen_random_uuid()

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users, created automatically on signup
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  contact_note text,
  grade_or_year text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- Auto-create a pending profile whenever someone signs up via Supabase Auth.
-- Also records which role(s) they asked for at signup (passed through
-- auth.signUp's options.data.requested_roles as a JSON array of role codes),
-- since the client has no authenticated session yet to insert that itself
-- when email confirmation is required.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );

  for v_role in
    select jsonb_array_elements_text(
      coalesce(new.raw_user_meta_data -> 'requested_roles', '[]'::jsonb)
    )
  loop
    if v_role in ('tutor', 'tutee') then
      insert into public.requested_roles (user_id, role_code)
      values (new.id, v_role)
      on conflict do nothing;
    end if;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- roles: additive, not exclusive — a profile can hold several at once
-- ---------------------------------------------------------------------------

create table roles (
  code text primary key,
  label text not null
);

insert into roles (code, label) values
  ('tutor', 'Tutor'),
  ('tutee', 'Tutee'),
  ('admin', 'Administrator');

create table user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role_code text not null references roles(code),
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role_code)
);

create index user_roles_role_code_idx on user_roles(role_code);

-- Which role(s) a person requested at signup, for the admin to review —
-- distinct from user_roles (what they've actually been granted).
create table requested_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role_code text not null references roles(code) check (role_code in ('tutor', 'tutee')),
  requested_at timestamptz not null default now(),
  primary key (user_id, role_code)
);

-- ---------------------------------------------------------------------------
-- Security helper functions (used throughout RLS policies)
-- ---------------------------------------------------------------------------

create or replace function has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role_code = p_role
  );
$$;

create or replace function is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

-- ---------------------------------------------------------------------------
-- Reference data: subjects & locations (admin-managed, everyone can read)
-- ---------------------------------------------------------------------------

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  building text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table tutor_subjects (
  tutor_id uuid not null references profiles(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  primary key (tutor_id, subject_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table roles enable row level security;
alter table user_roles enable row level security;
alter table requested_roles enable row level security;
alter table subjects enable row level security;
alter table locations enable row level security;
alter table tutor_subjects enable row level security;

-- profiles: everyone can read their own row; admins can read/update everyone's.
create policy profiles_select_own on profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on profiles
  for select using (has_role('admin'));

create policy profiles_update_own on profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    -- a non-admin cannot change their own approval status or who approved them
    and status = (select status from profiles where id = auth.uid())
  );

create policy profiles_update_admin on profiles
  for update using (has_role('admin'));

-- roles: readable by everyone (it's just the fixed list of role codes/labels).
create policy roles_select_all on roles
  for select using (true);

-- user_roles: a user can see their own roles; admins see and manage everyone's.
create policy user_roles_select_own on user_roles
  for select using (user_id = auth.uid());

create policy user_roles_select_admin on user_roles
  for select using (has_role('admin'));

create policy user_roles_write_admin on user_roles
  for insert with check (has_role('admin'));

create policy user_roles_delete_admin on user_roles
  for delete using (has_role('admin'));

-- requested_roles: a user manages their own request; admins see everyone's.
create policy requested_roles_select_own on requested_roles
  for select using (user_id = auth.uid());

create policy requested_roles_select_admin on requested_roles
  for select using (has_role('admin'));

create policy requested_roles_insert_own on requested_roles
  for insert with check (user_id = auth.uid());

-- subjects / locations: any approved user can read active reference data;
-- only admins can manage it.
create policy subjects_select_approved on subjects
  for select using (is_approved());

create policy subjects_write_admin on subjects
  for all using (has_role('admin')) with check (has_role('admin'));

create policy locations_select_approved on locations
  for select using (is_approved());

create policy locations_write_admin on locations
  for all using (has_role('admin')) with check (has_role('admin'));

-- tutor_subjects: readable by approved users (to show tutor expertise on the
-- calendar); a tutor manages their own rows, admins manage everyone's.
create policy tutor_subjects_select_approved on tutor_subjects
  for select using (is_approved());

create policy tutor_subjects_write_own on tutor_subjects
  for all using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

create policy tutor_subjects_write_admin on tutor_subjects
  for all using (has_role('admin')) with check (has_role('admin'));

-- ---------------------------------------------------------------------------
-- Seed reference data useful from day one (safe to edit later via admin UI)
-- ---------------------------------------------------------------------------

insert into locations (name, building) values
  ('Room 101', 'Main Building')
on conflict (name) do nothing;
