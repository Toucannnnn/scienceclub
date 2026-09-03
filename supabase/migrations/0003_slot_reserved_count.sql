-- A tutee browsing the calendar can't see other tutees' individual
-- reservation rows (correctly restricted by RLS) — but they still need to
-- know how many spots are taken on a multi-capacity slot. A computed
-- column (a function taking the row type as its sole argument, exposed by
-- PostgREST as a virtual column) provides just the count without exposing
-- who booked, running as SECURITY DEFINER so it reads past that RLS
-- restriction for this one aggregate.

create or replace function reserved_count(availability_slots)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from reservations
  where slot_id = $1.id and status = 'booked';
$$;

revoke all on function reserved_count(availability_slots) from public;
grant execute on function reserved_count(availability_slots) to authenticated;
