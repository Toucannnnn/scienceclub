-- Fixes a bug in get_guest_reservation (0005_guest_bookings.sql), found by
-- testing the guest-booking flow end-to-end against a live slot: in
-- PL/pgSQL, `returns table (id uuid, ...)` implicitly declares `id` (and
-- every other output column name) as an OUT-parameter variable in scope
-- for the whole function body — so the original function's unqualified
-- `where id = p_reservation_id` was ambiguous between that variable and
-- reservations.id, and every call failed with
-- "column reference \"id\" is ambiguous". Fixed by qualifying it via a
-- table alias. (`language sql` functions like get_public_open_slot(s)
-- don't have this problem — PL/pgSQL is the one that shadows output
-- column names as variables.)

create or replace function get_guest_reservation(p_reservation_id uuid, p_token uuid)
returns table (
  id uuid,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  tutor_name text,
  subject_name text,
  location_name text,
  guest_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
begin
  select * into v_reservation from reservations r where r.id = p_reservation_id;
  if not found
     or v_reservation.tutee_id is not null
     or v_reservation.guest_cancel_token is null
     or v_reservation.guest_cancel_token <> p_token
  then
    raise exception 'invalid_guest_link';
  end if;

  return query
    select
      v_reservation.id,
      v_reservation.status,
      s.starts_at,
      s.ends_at,
      tp.full_name,
      sub.name,
      loc.name,
      v_reservation.guest_name
    from availability_slots s
    join profiles tp on tp.id = s.tutor_id
    left join subjects sub on sub.id = s.subject_id
    left join locations loc on loc.id = s.location_id
    where s.id = v_reservation.slot_id;
end;
$$;
