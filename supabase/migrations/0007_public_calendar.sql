-- The calendar is now a single public page (src/app/(public)/calendar) that
-- both signed-out visitors and signed-in members see, rather than a
-- members-only /calendar plus a separate guest list at /book. That needs
-- one slot source both audiences can call:
--
--   * grant execute to `authenticated` as well as `anon` — previously
--     anon-only, so a signed-in member hitting the shared page would have
--     got a bare "permission denied for function". No new data is exposed:
--     these already returned the open-slot list to anyone unauthenticated.
--   * return tutor_id, so the UI can tell a tutor "this is your own slot"
--     and hide the book button (reserve_slot rejects it anyway with
--     cannot_book_own_slot — this just avoids offering a dead end). Tutor
--     UUIDs aren't secrets; profiles rows stay RLS-protected.
--
-- Everything else about these functions is unchanged from 0005.

drop function if exists get_public_open_slots();
drop function if exists get_public_open_slot(uuid);

create or replace function get_public_open_slots()
returns table (
  id uuid,
  tutor_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity int,
  max_capacity int,
  notes text,
  tutor_name text,
  subject_name text,
  location_name text,
  reserved_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.tutor_id, s.starts_at, s.ends_at, s.capacity, s.max_capacity, s.notes,
    tp.full_name, sub.name, loc.name,
    (select count(*)::int from reservations r where r.slot_id = s.id and r.status = 'booked')
  from availability_slots s
  join profiles tp on tp.id = s.tutor_id
  left join subjects sub on sub.id = s.subject_id
  left join locations loc on loc.id = s.location_id
  where s.status = 'open' and s.starts_at > now()
  order by s.starts_at asc;
$$;

revoke all on function get_public_open_slots() from public;
grant execute on function get_public_open_slots() to anon, authenticated;

create or replace function get_public_open_slot(p_slot_id uuid)
returns table (
  id uuid,
  tutor_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity int,
  max_capacity int,
  notes text,
  tutor_name text,
  subject_name text,
  location_name text,
  reserved_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.tutor_id, s.starts_at, s.ends_at, s.capacity, s.max_capacity, s.notes,
    tp.full_name, sub.name, loc.name,
    (select count(*)::int from reservations r where r.slot_id = s.id and r.status = 'booked')
  from availability_slots s
  join profiles tp on tp.id = s.tutor_id
  left join subjects sub on sub.id = s.subject_id
  left join locations loc on loc.id = s.location_id
  where s.id = p_slot_id and s.status = 'open' and s.starts_at > now();
$$;

revoke all on function get_public_open_slot(uuid) from public;
grant execute on function get_public_open_slot(uuid) to anon, authenticated;
