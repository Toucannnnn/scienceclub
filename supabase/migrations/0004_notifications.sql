-- Phase 2: notifications. Two channels, one call site.
--
-- In-app (`notifications`) and email (`email_outbox`) are written together
-- by notify_user(), a SECURITY DEFINER helper only this migration's own
-- functions can call (no grant to authenticated/anon — same pattern as
-- reserved_count() in 0003). Booking-lifecycle events call it inline from
-- the RPCs that already do those mutations (reserve_slot, cancel_reservation,
-- cancel_slot — redefined below with the same signatures); account approval
-- reacts via an AFTER UPDATE trigger on profiles, since that mutation is a
-- plain table update from the admin UI, not an RPC.
--
-- email_outbox is a queue, not a mailer: rows land here as 'pending' and a
-- Route Handler outside the database (protected by a shared secret, run on
-- an external schedule) drains it via the Resend API using the service-role
-- key. Nothing in Postgres talks to the internet.
--
-- Email timestamps below are formatted as stored (UTC) — good enough for an
-- MVP with a single-timezone club; swap the to_char calls for `at time zone
-- '<club tz>'` if that stops being true.

-- ---------------------------------------------------------------------------
-- Shared context lookup: the tutor/tutee/subject/location/time info every
-- notification message below needs, in one place instead of five.
-- ---------------------------------------------------------------------------

create type slot_notification_context as (
  tutor_id uuid,
  tutor_name text,
  tutee_name text,
  subject_name text,
  location_name text,
  starts_at timestamptz,
  ends_at timestamptz
);

create or replace function get_slot_context(p_slot_id uuid, p_tutee_id uuid)
returns slot_notification_context
language sql
stable
security definer
set search_path = public
as $$
  select
    s.tutor_id,
    tp.full_name,
    tep.full_name,
    sub.name,
    loc.name,
    s.starts_at,
    s.ends_at
  from availability_slots s
  join profiles tp on tp.id = s.tutor_id
  left join profiles tep on tep.id = p_tutee_id
  left join subjects sub on sub.id = s.subject_id
  left join locations loc on loc.id = s.location_id
  where s.id = p_slot_id;
$$;

-- ---------------------------------------------------------------------------
-- notifications: in-app. RLS restricts reads to the owner; every write goes
-- through notify_user() (insert) or the two mark-read RPCs below (update) —
-- no direct insert/update/delete grant to authenticated/anon.
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  reservation_id uuid references reservations(id) on delete set null,
  slot_id uuid references availability_slots(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on notifications(user_id, created_at desc);
create index notifications_user_unread_idx on notifications(user_id) where read_at is null;

alter table notifications enable row level security;

create policy notifications_select_own on notifications
  for select using (user_id = auth.uid());

revoke insert, update, delete on notifications from authenticated, anon;

-- ---------------------------------------------------------------------------
-- email_outbox: the send queue. No RLS policies at all — not even select —
-- so only the service-role key (used exclusively by the cron dispatch Route
-- Handler, never shipped to the browser) can touch it; that key bypasses
-- RLS entirely, which is exactly the access this table needs.
-- ---------------------------------------------------------------------------

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  to_email text not null,
  subject text not null,
  body_html text not null,
  link text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index email_outbox_pending_idx on email_outbox(created_at) where status = 'pending';

alter table email_outbox enable row level security;
revoke all on email_outbox from authenticated, anon;

-- ---------------------------------------------------------------------------
-- notify_user: write both channels for one recipient. p_link is an in-app
-- route (e.g. '/my-bookings'); the dispatcher turns it into an absolute URL
-- using its own site-origin env var, not anything stored here.
-- ---------------------------------------------------------------------------

create or replace function notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_email_subject text,
  p_email_html text,
  p_reservation_id uuid default null,
  p_slot_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  insert into notifications (user_id, type, title, body, link, reservation_id, slot_id)
  values (p_user_id, p_type, p_title, p_body, p_link, p_reservation_id, p_slot_id);

  select email into v_email from profiles where id = p_user_id;
  if v_email is not null then
    insert into email_outbox (user_id, to_email, subject, body_html, link)
    values (p_user_id, v_email, p_email_subject, p_email_html, p_link);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark-read RPCs — the only writes a regular user can make to notifications.
-- ---------------------------------------------------------------------------

create or replace function mark_notification_read(p_notification_id uuid)
returns notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row notifications%rowtype;
begin
  update notifications set read_at = now()
    where id = p_notification_id and user_id = auth.uid()
    returning * into v_row;
  if not found then
    raise exception 'notification_not_found';
  end if;
  return v_row;
end;
$$;

create or replace function mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update notifications set read_at = now()
    where user_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function mark_notification_read(uuid) from public;
grant execute on function mark_notification_read(uuid) to authenticated;
revoke all on function mark_all_notifications_read() from public;
grant execute on function mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Booking lifecycle: redefine the Phase 1 RPCs (same signatures) to notify
-- both sides of each event.
-- ---------------------------------------------------------------------------

create or replace function reserve_slot(p_slot_id uuid)
returns reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot availability_slots%rowtype;
  v_count int;
  v_tutee uuid := auth.uid();
  v_reservation reservations%rowtype;
  ctx slot_notification_context;
begin
  if v_tutee is null then
    raise exception 'not_authenticated';
  end if;
  if not is_approved() then
    raise exception 'not_approved';
  end if;
  if has_active_restriction(v_tutee) then
    raise exception 'booking_restricted';
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
  if v_slot.tutor_id = v_tutee then
    raise exception 'cannot_book_own_slot';
  end if;

  select count(*) into v_count from reservations
    where slot_id = p_slot_id and status = 'booked';

  if v_count >= v_slot.capacity then
    update availability_slots set status = 'full' where id = p_slot_id;
    raise exception 'slot_full';
  end if;

  insert into reservations (slot_id, tutee_id, status)
    values (p_slot_id, v_tutee, 'booked')
    returning * into v_reservation;

  if v_count + 1 >= v_slot.capacity then
    update availability_slots set status = 'full' where id = p_slot_id;
  end if;

  ctx := get_slot_context(p_slot_id, v_tutee);

  perform notify_user(
    v_tutee, 'booking_confirmed', 'Booking confirmed',
    format('You''re booked with %s on %s.', ctx.tutor_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    '/my-bookings',
    'Booking confirmed',
    format('<p>You''re booked with <strong>%s</strong> on %s.</p>', ctx.tutor_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    v_reservation.id, p_slot_id
  );

  perform notify_user(
    ctx.tutor_id, 'new_booking', 'New booking on your slot',
    format('%s booked your %s session on %s.', ctx.tutee_name,
      coalesce(ctx.subject_name, 'tutoring'), to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    '/availability',
    'New booking on your availability',
    format('<p><strong>%s</strong> booked your session on %s.</p>', ctx.tutee_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    v_reservation.id, p_slot_id
  );

  return v_reservation;
end;
$$;

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
  if v_reservation.tutee_id <> v_caller and not has_role('admin') then
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

  v_self := (v_caller = v_reservation.tutee_id);
  ctx := get_slot_context(v_slot.id, v_reservation.tutee_id);

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

  perform notify_user(
    ctx.tutor_id, 'booking_cancelled', 'A booking was cancelled',
    format('%s cancelled their booking on %s. Your slot is open again.', ctx.tutee_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    '/availability',
    'A booking was cancelled',
    format('<p><strong>%s</strong> cancelled their booking on %s. Your slot is open again.</p>', ctx.tutee_name,
      to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
    v_reservation.id, v_slot.id
  );

  return v_reservation;
end;
$$;

create or replace function set_slot_capacity(p_slot_id uuid, p_new_capacity int)
returns availability_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot availability_slots%rowtype;
  v_caller uuid := auth.uid();
  v_count int;
  v_is_participant boolean;
begin
  select * into v_slot from availability_slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot_not_found';
  end if;

  select exists(
    select 1 from reservations
    where slot_id = p_slot_id and tutee_id = v_caller and status = 'booked'
  ) into v_is_participant;

  if not (v_is_participant or v_slot.tutor_id = v_caller or has_role('admin')) then
    raise exception 'not_authorized';
  end if;
  if p_new_capacity < 1 or p_new_capacity > v_slot.max_capacity then
    raise exception 'capacity_out_of_range';
  end if;

  select count(*) into v_count from reservations
    where slot_id = p_slot_id and status = 'booked';

  if p_new_capacity < v_count then
    raise exception 'capacity_below_current_bookings';
  end if;

  update availability_slots
    set capacity = p_new_capacity,
        status = case
          when status = 'cancelled' then status
          when v_count >= p_new_capacity then 'full'
          else 'open'
        end
    where id = p_slot_id
    returning * into v_slot;

  return v_slot;
end;
$$;

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

  -- Notify affected tutees before flipping their reservations to
  -- 'cancelled', so this can select on status = 'booked' rather than
  -- reconstructing "who was just cancelled" after the fact.
  for v_res in
    select id, tutee_id from reservations
    where slot_id = p_slot_id and status = 'booked'
  loop
    ctx := get_slot_context(p_slot_id, v_res.tutee_id);
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
-- Account approval: reacts to the admin UI's plain `update profiles` rather
-- than an RPC, so this has to be a trigger.
-- ---------------------------------------------------------------------------

create or replace function notify_account_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform notify_user(
      new.id, 'account_approved', 'Account approved',
      'Your account has been approved — you can now book sessions.',
      '/dashboard',
      'Your account has been approved',
      '<p>Your account has been approved. Log in to start booking sessions.</p>'
    );
  end if;
  return new;
end;
$$;

create trigger profiles_notify_approved
  after update on profiles
  for each row
  execute function notify_account_approved();

-- ---------------------------------------------------------------------------
-- Session reminders: time-based, not event-based, so there's no mutation to
-- hang a trigger off. enqueue_due_reminders() is called by the cron dispatch
-- Route Handler (via the service-role key) right before it drains the
-- outbox. reminder_sent_at / tutor_reminder_sent_at make each call
-- idempotent — a reservation or slot is only ever reminded once, regardless
-- of how often the dispatcher runs. The 55-65 minute window pairs with a
-- ~10 minute cron cadence (see SETUP.md); tutor reminders are deduped per
-- slot rather than per reservation so a tutor with 5 tutees in one slot
-- gets one reminder, not five.
-- ---------------------------------------------------------------------------

alter table reservations add column reminder_sent_at timestamptz;
alter table availability_slots add column tutor_reminder_sent_at timestamptz;

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
    select res.id as reservation_id, res.tutee_id, res.slot_id,
           s.tutor_id, s.tutor_reminder_sent_at
    from reservations res
    join availability_slots s on s.id = res.slot_id
    where res.status = 'booked'
      and res.reminder_sent_at is null
      and s.starts_at between now() + interval '55 minutes' and now() + interval '65 minutes'
    for update of res
  loop
    ctx := get_slot_context(r.slot_id, r.tutee_id);

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
    update reservations set reminder_sent_at = now() where id = r.reservation_id;

    if r.tutor_reminder_sent_at is null then
      perform notify_user(
        r.tutor_id, 'session_reminder', 'Upcoming session in about an hour',
        format('Your session with %s starts at %s.', ctx.tutee_name,
          to_char(ctx.starts_at, 'Dy FMMon FMDD, HH12:MI AM')),
        '/availability',
        'Upcoming session reminder',
        format('<p>Your session with <strong>%s</strong> starts around %s.</p>', ctx.tutee_name,
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

revoke all on function enqueue_due_reminders() from public;
grant execute on function enqueue_due_reminders() to service_role;
