-- Guest bookings: a tutee can book with just a name + email — no account,
-- no admin-approval wait. Mechanism: reservations gets a nullable
-- guest_name/guest_email/guest_cancel_token trio, mutually exclusive with
-- tutee_id via a check constraint. Two new RPCs — reserve_slot_as_guest and
-- cancel_reservation_as_guest — are granted to `anon`, the only anon
-- grants anywhere in this schema; a guest never gets a `profiles` row or a
-- Supabase Auth session, so all their access is token-gated through these
-- RPCs rather than RLS. Guest notifications reuse email_outbox (already
-- nullable on user_id) via notify_guest_email(); guests never get an
-- in-app `notifications` row since they have no login to see it in.
--
-- This also fixes a real bug uncovered while making tutee_id nullable:
-- cancel_reservation's authorization check used `<>` against tutee_id,
-- which is NULL-unsafe (`null <> x` evaluates to NULL, and `if NULL` is
-- false in PL/pgSQL) — a non-admin caller could have cancelled *any* guest
-- reservation by id once tutee_id could be null. Fixed with
-- IS DISTINCT FROM. cancel_slot and enqueue_due_reminders are also
-- redefined, since both already loop over reservations and call
-- notify_user(tutee_id, ...) — notifications.user_id is NOT NULL, so
-- either would fail outright the first time it touched a guest row.
--
-- Also adds get_slot_attendees(): today's RLS already lets a tutor SELECT
-- reservation rows for their own slots, but there's no policy letting them
-- read another user's `profiles` row to resolve a name — so this is
-- SECURITY DEFINER for that one join, same pattern as reserved_count() in
-- 0003 and get_public_open_slot(s) below.

-- ---------------------------------------------------------------------------
-- reservations: room for a guest identity alongside an account one.
-- ---------------------------------------------------------------------------

alter table reservations alter column tutee_id drop not null;
alter table reservations add column guest_name text;
alter table reservations add column guest_email text;
alter table reservations add column guest_cancel_token uuid;

alter table reservations add constraint reservation_identity_xor check (
  (tutee_id is not null and guest_email is null and guest_name is null and guest_cancel_token is null)
  or
  (tutee_id is null and guest_email is not null and guest_name is not null and guest_cancel_token is not null)
);

-- reserve_slot_as_guest/cancel_reservation_as_guest are reachable directly
-- over PostgREST by `anon`, not only through our own Server Action — DB-level
-- validation carries more weight here than elsewhere in this schema, where
-- the client is always at least an approved account.
alter table reservations add constraint guest_name_len
  check (guest_name is null or char_length(guest_name) between 1 and 200);
alter table reservations add constraint guest_email_len
  check (guest_email is null or char_length(guest_email) between 3 and 320);

-- Guest equivalent of uq_reservation_active_per_tutee — one active booking
-- per (slot, email), case-insensitively.
create unique index uq_reservation_active_per_guest_email
  on reservations(slot_id, lower(guest_email))
  where status = 'booked' and guest_email is not null;

create index reservations_guest_email_idx
  on reservations(guest_email) where guest_email is not null;

-- Link back to what a guest email was about — guest bookings have no
-- `notifications` row to cross-reference for debugging.
alter table email_outbox add column reservation_id uuid references reservations(id) on delete set null;
alter table email_outbox add column slot_id uuid references availability_slots(id) on delete set null;

-- ---------------------------------------------------------------------------
-- notify_guest_email: email-only counterpart to notify_user(), for
-- recipients with no profiles row. No grant to authenticated/anon — same
-- as notify_user, only callable from other definer functions owned by the
-- same role.
-- ---------------------------------------------------------------------------

create or replace function notify_guest_email(
  p_email text,
  p_subject text,
  p_email_html text,
  p_link text,
  p_reservation_id uuid default null,
  p_slot_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into email_outbox (user_id, to_email, subject, body_html, link, reservation_id, slot_id)
  values (null, lower(trim(p_email)), p_subject, p_email_html, p_link, p_reservation_id, p_slot_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- reserve_slot_as_guest: the no-account booking path. Same capacity-locking
-- race-safety as reserve_slot, minus every account-related check (a guest
-- has no auth.uid(), no approval status, no restriction history).
-- ---------------------------------------------------------------------------

create or replace function reserve_slot_as_guest(p_slot_id uuid, p_name text, p_email text)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot availability_slots%rowtype;
  v_count int;
  v_name text := trim(p_name);
  v_email text := lower(trim(p_email));
  v_token uuid := gen_random_uuid();
  v_reservation reservations%rowtype;
  ctx slot_notification_context;
begin
  if v_name = '' or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid_guest_details';
  end if;

  select * into v_slot from availability_slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot_not_found';
  end if;
  if v_slot.status <> 'open' then
    raise exception 'slot_not_open';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'slot_in_past';
  end if;

  select count(*) into v_count from reservations
    where slot_id = p_slot_id and status = 'booked';

  if v_count >= v_slot.capacity then
    update availability_slots set status = 'full' where id = p_slot_id;
    raise exception 'slot_full';
  end if;

  insert into reservations (slot_id, tutee_id, status, guest_name, guest_email, guest_cancel_token)
    values (p_slot_id, null, 'booked', v_name, v_email, v_token)
    returning * into v_reservation;

  if v_count + 1 >= v_slot.capacity then
    update availability_slots set status = 'full' where id = p_slot_id;
  end if;

  ctx := get_slot_context(p_slot_id, null);

  perform notify_guest_email(
    v_email, 'Booking confirmed',
    format('<p>You''re booked with <strong>%s</strong> on %s.</p><p>Use the button below any time to view or cancel your booking — this link won''t be emailed again, so hang on to it.</p>',
      ctx.tutor_name, to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    '/book/manage/' || v_reservation.id || '?t=' || v_token,
    v_reservation.id, p_slot_id
  );

  perform notify_user(
    ctx.tutor_id, 'new_booking', 'New booking on your slot',
    format('%s booked your %s session on %s.', v_name,
      coalesce(ctx.subject_name, 'tutoring'), to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    '/availability',
    'New booking on your availability',
    format('<p><strong>%s</strong> booked your session on %s.</p>', v_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    v_reservation.id, p_slot_id
  );

  return v_reservation;
end;
$$;

revoke all on function reserve_slot_as_guest(uuid, text, text) from public;
grant execute on function reserve_slot_as_guest(uuid, text, text) to anon;

-- ---------------------------------------------------------------------------
-- cancel_reservation_as_guest: token-gated self-cancellation. Same generic
-- failure ('invalid_guest_link') whether the id doesn't exist or the token
-- is wrong, so the two cases aren't distinguishable to a prober.
-- ---------------------------------------------------------------------------

create or replace function cancel_reservation_as_guest(p_reservation_id uuid, p_token uuid)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
  v_slot availability_slots%rowtype;
  v_count int;
  ctx slot_notification_context;
begin
  select * into v_reservation from reservations where id = p_reservation_id for update;
  if not found
     or v_reservation.tutee_id is not null
     or v_reservation.guest_cancel_token is null
     or v_reservation.guest_cancel_token <> p_token
  then
    raise exception 'invalid_guest_link';
  end if;
  if v_reservation.status <> 'booked' then
    raise exception 'reservation_not_active';
  end if;

  select * into v_slot from availability_slots where id = v_reservation.slot_id for update;

  update reservations
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'guest_self_cancelled'
    where id = p_reservation_id
    returning * into v_reservation;

  select count(*) into v_count from reservations
    where slot_id = v_slot.id and status = 'booked';

  if v_slot.status = 'full' and v_count < v_slot.capacity then
    update availability_slots set status = 'open' where id = v_slot.id;
  end if;

  ctx := get_slot_context(v_slot.id, null);

  perform notify_guest_email(
    v_reservation.guest_email, 'Booking cancelled',
    format('<p>You cancelled your session with <strong>%s</strong> on %s.</p>', ctx.tutor_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    '/book', v_reservation.id, v_slot.id
  );

  perform notify_user(
    ctx.tutor_id, 'booking_cancelled', 'A booking was cancelled',
    format('%s cancelled their booking on %s. Your slot is open again.', v_reservation.guest_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    '/availability',
    'A booking was cancelled',
    format('<p><strong>%s</strong> cancelled their booking on %s. Your slot is open again.</p>', v_reservation.guest_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    v_reservation.id, v_slot.id
  );

  return v_reservation;
end;
$$;

revoke all on function cancel_reservation_as_guest(uuid, uuid) from public;
grant execute on function cancel_reservation_as_guest(uuid, uuid) to anon;

-- ---------------------------------------------------------------------------
-- get_guest_reservation: read-only, token-gated. Used directly by the
-- manage page's Server Component — same convention as the calendar page
-- calling getOpenSlots directly, no Server Action needed for a plain read.
-- ---------------------------------------------------------------------------

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
  select * into v_reservation from reservations where id = p_reservation_id;
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

revoke all on function get_guest_reservation(uuid, uuid) from public;
grant execute on function get_guest_reservation(uuid, uuid) to anon;

-- ---------------------------------------------------------------------------
-- get_public_open_slots / get_public_open_slot: anon-readable open-slot
-- browsing. Deliberately a function, not a widened RLS policy on
-- availability_slots — that would also need a matching policy on profiles
-- to resolve the tutor's name, exposing more of profiles than intended.
-- This only ever selects full_name, never email/phone/anything else.
--
-- Privacy note: tutor names, subjects, locations, and session times for
-- every open slot become visible to anyone on the internet, not just
-- approved club members — inherent to "browse and book without an
-- account," not something narrowed by the function-vs-RLS choice.
-- ---------------------------------------------------------------------------

create or replace function get_public_open_slots()
returns table (
  id uuid,
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
    s.id, s.starts_at, s.ends_at, s.capacity, s.max_capacity, s.notes,
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
grant execute on function get_public_open_slots() to anon;

create or replace function get_public_open_slot(p_slot_id uuid)
returns table (
  id uuid,
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
    s.id, s.starts_at, s.ends_at, s.capacity, s.max_capacity, s.notes,
    tp.full_name, sub.name, loc.name,
    (select count(*)::int from reservations r where r.slot_id = s.id and r.status = 'booked')
  from availability_slots s
  join profiles tp on tp.id = s.tutor_id
  left join subjects sub on sub.id = s.subject_id
  left join locations loc on loc.id = s.location_id
  where s.id = p_slot_id and s.status = 'open' and s.starts_at > now();
$$;

revoke all on function get_public_open_slot(uuid) from public;
grant execute on function get_public_open_slot(uuid) to anon;

-- ---------------------------------------------------------------------------
-- get_slot_attendees: tutor-facing "who's actually coming" — name for
-- every booking (account or guest), plus email for guest bookings. RLS
-- already lets a tutor SELECT reservation rows for their own slots
-- (reservations_select_own_or_tutor_or_admin); this only adds the ability
-- to resolve an account booker's name, which profiles' RLS doesn't permit
-- a tutor to read directly for someone else's row.
-- ---------------------------------------------------------------------------

create or replace function get_slot_attendees(p_slot_id uuid)
returns table (
  reservation_id uuid,
  status text,
  booked_at timestamptz,
  display_name text,
  guest_email text,
  is_guest boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slot availability_slots%rowtype;
begin
  select * into v_slot from availability_slots where id = p_slot_id;
  if not found then
    raise exception 'slot_not_found';
  end if;
  if v_slot.tutor_id <> auth.uid() and not has_role('admin') then
    raise exception 'not_authorized';
  end if;

  return query
    select
      r.id,
      r.status,
      r.booked_at,
      coalesce(p.full_name, r.guest_name),
      r.guest_email,
      (r.tutee_id is null)
    from reservations r
    left join profiles p on p.id = r.tutee_id
    where r.slot_id = p_slot_id
    order by r.booked_at asc;
end;
$$;

revoke all on function get_slot_attendees(uuid) from public;
grant execute on function get_slot_attendees(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_reservation: redefined (same signature) — null-safety fix plus a
-- guest branch for the two notify calls.
-- ---------------------------------------------------------------------------

create or replace function cancel_reservation(p_reservation_id uuid)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
  v_slot availability_slots%rowtype;
  v_caller uuid := auth.uid();
  v_count int;
  v_self boolean;
  ctx slot_notification_context;
begin
  select * into v_reservation from reservations where id = p_reservation_id;
  if not found then
    raise exception 'reservation_not_found';
  end if;
  -- IS DISTINCT FROM, not <>: tutee_id can now be null (a guest booking),
  -- and `null <> v_caller` is NULL — `if NULL` is false in PL/pgSQL, which
  -- would let any non-admin authenticated caller cancel *any* guest
  -- booking by id.
  if v_reservation.tutee_id is distinct from v_caller and not has_role('admin') then
    raise exception 'not_authorized';
  end if;
  if v_reservation.status <> 'booked' then
    raise exception 'reservation_not_active';
  end if;

  select * into v_slot from availability_slots
    where id = v_reservation.slot_id for update;

  update reservations
    set status = 'cancelled', cancelled_at = now(), cancelled_by = v_caller
    where id = p_reservation_id
    returning * into v_reservation;

  select count(*) into v_count from reservations
    where slot_id = v_slot.id and status = 'booked';

  if v_slot.status = 'full' and v_count < v_slot.capacity then
    update availability_slots set status = 'open' where id = v_slot.id;
  end if;

  ctx := get_slot_context(v_slot.id, v_reservation.tutee_id);

  if v_reservation.tutee_id is not null then
    v_self := (v_caller = v_reservation.tutee_id);

    perform notify_user(
      v_reservation.tutee_id, 'booking_cancelled', 'Booking cancelled',
      case when v_self
        then format('You cancelled your session with %s on %s.', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM'))
        else format('Your session with %s on %s was cancelled by an admin.', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM'))
      end,
      '/my-bookings',
      'Booking cancelled',
      case when v_self
        then format('<p>You cancelled your session with <strong>%s</strong> on %s.</p>', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM'))
        else format('<p>Your session with <strong>%s</strong> on %s was cancelled by an admin.</p>', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM'))
      end,
      v_reservation.id, v_slot.id
    );
  else
    -- Only an admin ever reaches this branch for a guest row — a guest has
    -- no session to call cancel_reservation with; they use
    -- cancel_reservation_as_guest instead.
    perform notify_guest_email(
      v_reservation.guest_email, 'Booking cancelled',
      format('<p>Your session with <strong>%s</strong> on %s was cancelled by an admin.</p>', ctx.tutor_name,
        to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
      '/book', v_reservation.id, v_slot.id
    );
  end if;

  perform notify_user(
    ctx.tutor_id, 'booking_cancelled', 'A booking was cancelled',
    format('%s cancelled their booking on %s. Your slot is open again.',
      coalesce(ctx.tutee_name, v_reservation.guest_name),
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    '/availability',
    'A booking was cancelled',
    format('<p><strong>%s</strong> cancelled their booking on %s. Your slot is open again.</p>',
      coalesce(ctx.tutee_name, v_reservation.guest_name),
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    v_reservation.id, v_slot.id
  );

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_slot: redefined (same signature) — guest branch for the
-- per-attendee notify loop.
-- ---------------------------------------------------------------------------

create or replace function cancel_slot(p_slot_id uuid)
returns availability_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot availability_slots%rowtype;
  v_caller uuid := auth.uid();
  v_res record;
  ctx slot_notification_context;
begin
  select * into v_slot from availability_slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot_not_found';
  end if;
  if v_slot.tutor_id <> v_caller and not has_role('admin') then
    raise exception 'not_authorized';
  end if;

  for v_res in
    select id, tutee_id, guest_name, guest_email from reservations
    where slot_id = p_slot_id and status = 'booked'
  loop
    ctx := get_slot_context(p_slot_id, v_res.tutee_id);
    if v_res.tutee_id is not null then
      perform notify_user(
        v_res.tutee_id, 'slot_cancelled', 'Session cancelled',
        format('Your session with %s on %s was cancelled by the tutor.', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        '/my-bookings',
        'Session cancelled',
        format('<p>Your session with <strong>%s</strong> on %s was cancelled by the tutor.</p>', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        v_res.id, p_slot_id
      );
    else
      perform notify_guest_email(
        v_res.guest_email, 'Session cancelled',
        format('<p>Your session with <strong>%s</strong> on %s was cancelled by the tutor.</p>', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        '/book', v_res.id, p_slot_id
      );
    end if;
  end loop;

  update reservations
    set status = 'cancelled', cancelled_at = now(), cancelled_by = v_caller,
        cancellation_reason = 'tutor_cancelled_slot'
    where slot_id = p_slot_id and status = 'booked';

  update availability_slots set status = 'cancelled' where id = p_slot_id
    returning * into v_slot;

  return v_slot;
end;
$$;

-- ---------------------------------------------------------------------------
-- enqueue_due_reminders: redefined — guest branch for the tutee-side
-- reminder; tutor-side reminder now names a guest via coalesce.
-- ---------------------------------------------------------------------------

create or replace function enqueue_due_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  ctx slot_notification_context;
begin
  for r in
    select res.id as reservation_id, res.tutee_id, res.guest_name, res.guest_email,
           res.guest_cancel_token, res.slot_id,
           s.tutor_id, s.tutor_reminder_sent_at
    from reservations res
    join availability_slots s on s.id = res.slot_id
    where res.status = 'booked'
      and res.reminder_sent_at is null
      and s.starts_at between now() + interval '55 minutes' and now() + interval '65 minutes'
    for update of res
  loop
    ctx := get_slot_context(r.slot_id, r.tutee_id);

    if r.tutee_id is not null then
      perform notify_user(
        r.tutee_id, 'session_reminder', 'Upcoming session in about an hour',
        format('Your session with %s starts at %s.', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        '/my-bookings',
        'Upcoming session reminder',
        format('<p>Your session with <strong>%s</strong> starts around %s.</p>', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        r.reservation_id, r.slot_id
      );
    else
      perform notify_guest_email(
        r.guest_email, 'Upcoming session reminder',
        format('<p>Your session with <strong>%s</strong> starts around %s.</p>', ctx.tutor_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        '/book/manage/' || r.reservation_id || '?t=' || r.guest_cancel_token,
        r.reservation_id, r.slot_id
      );
    end if;
    update reservations set reminder_sent_at = now() where id = r.reservation_id;

    if r.tutor_reminder_sent_at is null then
      perform notify_user(
        r.tutor_id, 'session_reminder', 'Upcoming session in about an hour',
        format('Your session with %s starts at %s.', coalesce(ctx.tutee_name, r.guest_name),
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        '/availability',
        'Upcoming session reminder',
        format('<p>Your session with <strong>%s</strong> starts around %s.</p>', coalesce(ctx.tutee_name, r.guest_name),
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        r.reservation_id, r.slot_id
      );
      update availability_slots set tutor_reminder_sent_at = now() where id = r.slot_id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
