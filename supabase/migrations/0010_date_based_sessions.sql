-- Stage 1b: sessions become date-based.
--
-- Every session is the same half hour — 12:15–12:45 PM Central — so a
-- time-of-day picker was always noise. `session_date` becomes the source of
-- truth and `starts_at`/`ends_at` become derived, which is what lets the
-- entire existing machinery (reminders, guest booking, notifications, the
-- public calendar feed) keep working untouched.

-- ---------------------------------------------------------------------------
-- Club clock. Everything time-related goes through these so there is exactly
-- one place that knows when a session happens.
--
-- `club_today()` exists because `current_date` is the *server's* date. At
-- 11 PM Central it's already tomorrow in UTC, which would let a tutor post a
-- slot for "today" that had in fact already passed.
--
-- DST is a non-issue at these times: US transitions happen at 2:00 AM local,
-- so 12:00/12:15/12:45 PM is never in a spring-forward gap or a fall-back
-- ambiguity. Don't re-litigate this.
-- ---------------------------------------------------------------------------

create or replace function club_tz() returns text
  language sql immutable as $$ select 'America/Chicago'::text $$;

create or replace function session_starts_at(p_date date) returns timestamptz
  language sql stable as $$ select (p_date + time '12:15') at time zone club_tz() $$;

create or replace function session_ends_at(p_date date) returns timestamptz
  language sql stable as $$ select (p_date + time '12:45') at time zone club_tz() $$;

-- A tutee must ask for a tutor before noon on the day, so tutors have time
-- to see it. Used by the request flow in the next stage.
create or replace function request_cutoff_at(p_date date) returns timestamptz
  language sql stable as $$ select (p_date + time '12:00') at time zone club_tz() $$;

create or replace function club_today() returns date
  language sql stable as $$ select (now() at time zone club_tz())::date $$;

-- How a session reads in an email or notification. Note the `at time zone`:
-- every to_char in 0004/0005 formatted the raw timestamptz, which Postgres
-- renders in UTC — so a 12:15 Central session emailed as "05:15 PM". Since
-- the time is now always the same, the label states it as a constant and the
-- only variable part is the date.
create or replace function session_label(p_starts_at timestamptz) returns text
language sql stable
set search_path = public
as $$
  select to_char(p_starts_at at time zone club_tz(), 'Dy FMMon FMDD')
         || ', 12:15–12:45 PM';
$$;

revoke all on function session_label(timestamptz) from public, anon;
grant execute on function session_label(timestamptz) to authenticated;

revoke all on function club_tz() from public, anon;
revoke all on function session_starts_at(date) from public, anon;
revoke all on function session_ends_at(date) from public, anon;
revoke all on function request_cutoff_at(date) from public, anon;
revoke all on function club_today() from public, anon;
grant execute on function club_tz(), session_starts_at(date), session_ends_at(date),
  request_cutoff_at(date), club_today() to authenticated;

-- ---------------------------------------------------------------------------
-- School calendar. The club can't meet when there's no school, and the user
-- populates the closure list from the district calendar — this is
-- deliberately data, not hardcoded dates, so it survives every school year.
-- ---------------------------------------------------------------------------

create table school_terms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  constraint term_dates_valid check (ends_on >= starts_on)
);

-- The only two dates verifiable from the district's published calendar.
-- Holidays go in school_closures via the admin screen.
insert into school_terms (name, starts_on, ends_on)
values ('2026–2027', '2026-08-12', '2027-05-14');

create table school_closures (
  closure_date date primary key,
  label text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table school_terms enable row level security;
alter table school_closures enable row level security;

create policy school_terms_select_all on school_terms for select using (true);
create policy school_terms_write_admin on school_terms
  for all using (has_role('admin')) with check (has_role('admin'));

create policy school_closures_select_all on school_closures for select using (true);
create policy school_closures_write_admin on school_closures
  for all using (has_role('admin')) with check (has_role('admin'));

-- A date the club can actually meet: inside a term, on a weekday, not closed.
create or replace function is_school_day(p_date date) returns boolean
language sql stable
set search_path = public
as $$
  select
    extract(dow from p_date) between 1 and 5
    and exists (select 1 from school_terms t
                where p_date between t.starts_on and t.ends_on)
    and not exists (select 1 from school_closures c where c.closure_date = p_date);
$$;

-- Does the teacher who hosts this course's subject open their room that day?
create or replace function course_hosts_on(p_course_id uuid, p_date date)
returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1
    from courses c
    join teachers t on t.subject_id = c.subject_id and t.is_active
    where c.id = p_course_id
      and extract(dow from p_date)::smallint = any(t.weekdays)
  );
$$;

revoke all on function is_school_day(date) from public;
revoke all on function course_hosts_on(uuid, date) from public;
grant execute on function is_school_day(date), course_hosts_on(uuid, date)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- availability_slots: date-first.
-- ---------------------------------------------------------------------------

alter table availability_slots add column session_date date;
alter table availability_slots add column course_id uuid references courses(id);

-- Central time, not a bare ::date — that would read the timestamptz in UTC
-- and misdate any late-afternoon slot.
update availability_slots
  set session_date = (starts_at at time zone 'America/Chicago')::date;

alter table availability_slots alter column session_date set not null;

-- starts_at/ends_at are now derived. A trigger rather than a GENERATED
-- column because the expression isn't truly IMMUTABLE (the tz database can
-- change), and because a trigger lets us re-derive everything later with a
-- plain `update availability_slots set session_date = session_date`.
create or replace function slots_derive_times() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.starts_at := session_starts_at(new.session_date);
  new.ends_at := session_ends_at(new.session_date);
  return new;
end;
$$;

create trigger availability_slots_derive_times
  before insert or update of session_date on availability_slots
  for each row execute function slots_derive_times();

-- Re-derive the existing rows through the trigger so old slots snap to the
-- real session window instead of whatever arbitrary time they were posted at.
update availability_slots set session_date = session_date;

create index availability_slots_session_date_idx on availability_slots(session_date);

-- A tutor cannot be in two rooms at 12:15.
create unique index uq_slot_active_per_tutor_date
  on availability_slots(tutor_id, session_date)
  where status in ('open', 'full');

-- ---------------------------------------------------------------------------
-- Capacity and help mode.
--
-- "Unlimited" is a separate mode rather than a NULL capacity. 0005's header
-- documents what NULL-as-a-sentinel cost last time: making tutee_id nullable
-- turned `tutee_id <> v_caller` into NULL, and `if NULL` is false, so an
-- authorization check silently failed *open*. Capacity stays NOT NULL and
-- every comparison is guarded by the mode.
-- ---------------------------------------------------------------------------

alter table availability_slots
  add column capacity_mode text not null default 'limited'
    check (capacity_mode in ('limited', 'unlimited')),
  add column help_mode text
    check (help_mode in ('individual', 'group'));

update availability_slots
  set help_mode = case when max_capacity > 1 then 'group' else 'individual' end
  where help_mode is null;

alter table availability_slots alter column help_mode set not null;

alter table availability_slots drop constraint availability_slots_capacity_check;
alter table availability_slots drop constraint availability_slots_max_capacity_check;
alter table availability_slots add constraint capacity_range
  check (capacity between 1 and 100);
alter table availability_slots add constraint max_capacity_range
  check (max_capacity between 1 and 100);

-- ---------------------------------------------------------------------------
-- Slot creation moves to an RPC. Course approval, hosting weekday, closures
-- and term bounds can't be expressed in a WITH CHECK policy, and the client
-- must no longer be able to name its own start time.
-- ---------------------------------------------------------------------------

drop policy availability_slots_insert_own_tutor on availability_slots;
revoke insert, update, delete on availability_slots from authenticated, anon;

create or replace function create_slot(
  p_session_date date,
  p_course_id uuid,
  p_capacity_mode text,
  p_capacity int,
  p_help_mode text,
  p_notes text default null
)
returns availability_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := auth.uid();
  v_slot availability_slots%rowtype;
  v_subject_id uuid;
  v_location_id uuid;
  v_capacity int;
begin
  if v_tutor is null then
    raise exception 'not_authenticated';
  end if;
  if not is_approved() then
    raise exception 'not_approved';
  end if;
  if not has_role('tutor') then
    raise exception 'not_a_tutor';
  end if;

  if not exists (
    select 1 from tutor_courses
    where tutor_id = v_tutor and course_id = p_course_id and status = 'approved'
  ) then
    raise exception 'course_not_approved';
  end if;

  if p_session_date < club_today() then
    raise exception 'date_in_past';
  end if;
  if not is_school_day(p_session_date) then
    raise exception 'not_a_school_day';
  end if;
  if not course_hosts_on(p_course_id, p_session_date) then
    raise exception 'teacher_not_hosting';
  end if;

  if p_capacity_mode not in ('limited', 'unlimited') then
    raise exception 'invalid_capacity_mode';
  end if;
  if p_help_mode not in ('individual', 'group') then
    raise exception 'invalid_help_mode';
  end if;

  -- An unlimited slot still needs a number in the column; 100 is the ceiling
  -- and capacity_mode is what actually governs the comparisons.
  v_capacity := case when p_capacity_mode = 'unlimited' then 100 else p_capacity end;
  if v_capacity is null or v_capacity < 1 or v_capacity > 100 then
    raise exception 'invalid_capacity';
  end if;

  select subject_id into v_subject_id from courses where id = p_course_id;
  select id into v_location_id from locations where is_active order by name limit 1;

  insert into availability_slots (
    tutor_id, subject_id, course_id, location_id, session_date,
    capacity, max_capacity, capacity_mode, help_mode, notes, status
  ) values (
    v_tutor, v_subject_id, p_course_id, v_location_id, p_session_date,
    v_capacity, v_capacity, p_capacity_mode, p_help_mode,
    nullif(trim(coalesce(p_notes, '')), ''), 'open'
  )
  returning * into v_slot;

  return v_slot;
exception
  when unique_violation then
    raise exception 'already_posted_that_day';
end;
$$;

revoke all on function create_slot(date, uuid, text, int, text, text) from public, anon;
grant execute on function create_slot(date, uuid, text, int, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Capacity checks become mode-aware. An unlimited slot never fills, so it
-- never flips to 'full' and can never be "locked to just us".
-- ---------------------------------------------------------------------------

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
  if v_slot.capacity_mode = 'unlimited' then
    raise exception 'unlimited_slot_not_lockable';
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

-- ---------------------------------------------------------------------------
-- The public feed gains the new fields. Return type changed, so drop first
-- (0007 had to do the same).
-- ---------------------------------------------------------------------------

drop function if exists get_public_open_slots();
drop function if exists get_public_open_slot(uuid);

create or replace function get_public_open_slots()
returns table (
  id uuid, tutor_id uuid, session_date date, starts_at timestamptz,
  ends_at timestamptz, capacity int, max_capacity int, capacity_mode text,
  help_mode text, notes text, tutor_name text, subject_name text,
  course_name text, location_name text, reserved_count int
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.tutor_id, s.session_date, s.starts_at, s.ends_at,
         s.capacity, s.max_capacity, s.capacity_mode, s.help_mode, s.notes,
         tp.full_name, sub.name, crs.name, loc.name,
         (select count(*)::int from reservations r
          where r.slot_id = s.id and r.status = 'booked')
  from availability_slots s
  join profiles tp on tp.id = s.tutor_id
  left join subjects sub on sub.id = s.subject_id
  left join courses crs on crs.id = s.course_id
  left join locations loc on loc.id = s.location_id
  where s.status = 'open' and s.starts_at > now()
  order by s.session_date asc;
$$;

create or replace function get_public_open_slot(p_slot_id uuid)
returns table (
  id uuid, tutor_id uuid, session_date date, starts_at timestamptz,
  ends_at timestamptz, capacity int, max_capacity int, capacity_mode text,
  help_mode text, notes text, tutor_name text, subject_name text,
  course_name text, location_name text, reserved_count int
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.tutor_id, s.session_date, s.starts_at, s.ends_at,
         s.capacity, s.max_capacity, s.capacity_mode, s.help_mode, s.notes,
         tp.full_name, sub.name, crs.name, loc.name,
         (select count(*)::int from reservations r
          where r.slot_id = s.id and r.status = 'booked')
  from availability_slots s
  join profiles tp on tp.id = s.tutor_id
  left join subjects sub on sub.id = s.subject_id
  left join courses crs on crs.id = s.course_id
  left join locations loc on loc.id = s.location_id
  where s.id = p_slot_id and s.status = 'open' and s.starts_at > now();
$$;

revoke all on function get_public_open_slots() from public;
revoke all on function get_public_open_slot(uuid) from public;
grant execute on function get_public_open_slots(), get_public_open_slot(uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- reserve_slot / reserve_slot_as_guest: honour capacity_mode.
-- ---------------------------------------------------------------------------

create or replace function reserve_slot(p_slot_id uuid)
returns reservations
language plpgsql security definer set search_path = public
as $$
declare
  v_slot availability_slots%rowtype;
  v_count int;
  v_tutee uuid := auth.uid();
  v_reservation reservations%rowtype;
  ctx slot_notification_context;
begin
  if v_tutee is null then raise exception 'not_authenticated'; end if;
  if not is_approved() then raise exception 'not_approved'; end if;
  if has_active_restriction(v_tutee) then raise exception 'booking_restricted'; end if;

  select * into v_slot from availability_slots where id = p_slot_id for update;
  if not found then raise exception 'slot_not_found'; end if;
  if v_slot.status <> 'open' then raise exception 'slot_not_open'; end if;
  if v_slot.starts_at <= now() then raise exception 'slot_in_past'; end if;
  if v_slot.tutor_id = v_tutee then raise exception 'cannot_book_own_slot'; end if;

  select count(*) into v_count from reservations
    where slot_id = p_slot_id and status = 'booked';

  if v_slot.capacity_mode = 'limited' and v_count >= v_slot.capacity then
    update availability_slots set status = 'full' where id = p_slot_id;
    raise exception 'slot_full';
  end if;

  insert into reservations (slot_id, tutee_id, status)
    values (p_slot_id, v_tutee, 'booked')
    returning * into v_reservation;

  if v_slot.capacity_mode = 'limited' and v_count + 1 >= v_slot.capacity then
    update availability_slots set status = 'full' where id = p_slot_id;
  end if;

  ctx := get_slot_context(p_slot_id, v_tutee);

  perform notify_user(
    v_tutee, 'booking_confirmed', 'Booking confirmed',
    format('You''re booked with %s on %s.', ctx.tutor_name, session_label(ctx.starts_at)),
    '/my-bookings', 'Booking confirmed',
    format('<p>You''re booked with <strong>%s</strong> on %s.</p>',
      ctx.tutor_name, session_label(ctx.starts_at)),
    v_reservation.id, p_slot_id
  );

  perform notify_user(
    ctx.tutor_id, 'new_booking', 'New booking on your slot',
    format('%s booked your %s session on %s.', ctx.tutee_name,
      coalesce(ctx.subject_name, 'tutoring'), session_label(ctx.starts_at)),
    '/availability', 'New booking on your availability',
    format('<p><strong>%s</strong> booked your session on %s.</p>',
      ctx.tutee_name, session_label(ctx.starts_at)),
    v_reservation.id, p_slot_id
  );

  return v_reservation;
end;
$$;

create or replace function reserve_slot_as_guest(p_slot_id uuid, p_name text, p_email text)
returns reservations
language plpgsql security definer set search_path = public
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
  if not found then raise exception 'slot_not_found'; end if;
  if v_slot.status <> 'open' then raise exception 'slot_not_open'; end if;
  if v_slot.starts_at <= now() then raise exception 'slot_in_past'; end if;

  select count(*) into v_count from reservations
    where slot_id = p_slot_id and status = 'booked';

  if v_slot.capacity_mode = 'limited' and v_count >= v_slot.capacity then
    update availability_slots set status = 'full' where id = p_slot_id;
    raise exception 'slot_full';
  end if;

  insert into reservations (slot_id, tutee_id, status, guest_name, guest_email, guest_cancel_token)
    values (p_slot_id, null, 'booked', v_name, v_email, v_token)
    returning * into v_reservation;

  if v_slot.capacity_mode = 'limited' and v_count + 1 >= v_slot.capacity then
    update availability_slots set status = 'full' where id = p_slot_id;
  end if;

  ctx := get_slot_context(p_slot_id, null);

  perform notify_guest_email(
    v_email, 'Booking confirmed',
    format('<p>You''re booked with <strong>%s</strong> on %s.</p><p>Use the button below any time to view or cancel your booking — this link won''t be emailed again, so hang on to it.</p>',
      ctx.tutor_name, session_label(ctx.starts_at)),
    '/book/manage/' || v_reservation.id || '?t=' || v_token,
    v_reservation.id, p_slot_id
  );

  perform notify_user(
    ctx.tutor_id, 'new_booking', 'New booking on your slot',
    format('%s booked your %s session on %s.', v_name,
      coalesce(ctx.subject_name, 'tutoring'), session_label(ctx.starts_at)),
    '/availability', 'New booking on your availability',
    format('<p><strong>%s</strong> booked your session on %s.</p>',
      v_name, session_label(ctx.starts_at)),
    v_reservation.id, p_slot_id
  );

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reminder window. With every session at 12:15, the whole day's reminders
-- used to land in one ten-minute slice — a single late cron run meant nobody
-- got reminded that day. reminder_sent_at already makes a wide window safe.
-- ---------------------------------------------------------------------------

create or replace function enqueue_due_reminders()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  ctx slot_notification_context;
begin
  for r in
    select res.id as reservation_id, res.tutee_id, res.guest_name, res.guest_email,
           res.guest_cancel_token, res.slot_id, s.tutor_id, s.tutor_reminder_sent_at
    from reservations res
    join availability_slots s on s.id = res.slot_id
    where res.status = 'booked'
      and res.reminder_sent_at is null
      and s.status <> 'cancelled'
      and s.starts_at between now() + interval '30 minutes'
                          and now() + interval '150 minutes'
    for update of res
  loop
    ctx := get_slot_context(r.slot_id, r.tutee_id);

    if r.tutee_id is not null then
      perform notify_user(
        r.tutee_id, 'session_reminder', 'Tutoring today at 12:15',
        format('Your session with %s is today, %s.', ctx.tutor_name, session_label(ctx.starts_at)),
        '/my-bookings', 'Tutoring today at 12:15',
        format('<p>Your session with <strong>%s</strong> is today — %s.</p>',
          ctx.tutor_name, session_label(ctx.starts_at)),
        r.reservation_id, r.slot_id
      );
    else
      perform notify_guest_email(
        r.guest_email, 'Tutoring today at 12:15',
        format('<p>Your session with <strong>%s</strong> is today — %s.</p>',
          ctx.tutor_name, session_label(ctx.starts_at)),
        '/book/manage/' || r.reservation_id || '?t=' || r.guest_cancel_token,
        r.reservation_id, r.slot_id
      );
    end if;
    update reservations set reminder_sent_at = now() where id = r.reservation_id;

    if r.tutor_reminder_sent_at is null then
      perform notify_user(
        r.tutor_id, 'session_reminder', 'You''re tutoring today at 12:15',
        format('Your session with %s is today, %s.',
          coalesce(ctx.tutee_name, r.guest_name), session_label(ctx.starts_at)),
        '/availability', 'You''re tutoring today at 12:15',
        format('<p>Your session with <strong>%s</strong> is today — %s.</p>',
          coalesce(ctx.tutee_name, r.guest_name), session_label(ctx.starts_at)),
        r.reservation_id, r.slot_id
      );
      update availability_slots set tutor_reminder_sent_at = now() where id = r.slot_id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
