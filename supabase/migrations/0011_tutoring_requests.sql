-- Stage 2: request-a-tutor tickets.
--
-- A tutee posts a request for a date a teacher is hosting; tutors approved
-- for that course get emailed and one can claim it. Claiming *materializes a
-- session* — a normal availability_slots row with the requester already
-- seated — so everything downstream (reservations, reminders, attendees,
-- hours later) sees exactly one shape and never has to ask "was this a
-- request or a slot".
--
-- Requests and slots are deliberately two tables. Merging them would force
-- availability_slots.tutor_id nullable (an unclaimed request has no tutor),
-- which silently breaks get_slot_context's inner join, both tutor_id RLS
-- policies (a NULL comparison fails *permissive*), cancel_slot's authz
-- check, and enqueue_due_reminders against notifications.user_id NOT NULL.
-- 0005's header documents that exact failure from making tutee_id nullable.
--
-- Lifecycle:
--
--   open ──claim (before noon)──────────────► claimed
--    │                                          ▲
--    ├──noon passes, nightly sweep──► unclaimed ┘  (late claim: a tutor who
--    │                                    │         actually showed up and
--    └──requester/admin cancels──► cancelled        did the session)
--
-- `unclaimed` is NOT terminal and NOT hidden. The ticket stays on the
-- calendar so the tutee can see it went unanswered — and so a tutor who
-- turned up anyway can still record it. Advance signup closes at noon;
-- reality doesn't.

create table tutoring_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  session_date date not null,

  -- Account requester XOR guest requester, mirroring reservations'
  -- reservation_identity_xor.
  requester_id uuid references profiles(id) on delete cascade,
  guest_name text,
  guest_email text,
  guest_manage_token uuid,

  note text,
  status text not null default 'open'
    check (status in ('open', 'claimed', 'unclaimed', 'cancelled')),
  claimed_by uuid references profiles(id),
  claimed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  created_at timestamptz not null default now(),

  constraint request_identity_xor check (
    (requester_id is not null and guest_email is null and guest_name is null
      and guest_manage_token is null)
    or
    (requester_id is null and guest_email is not null and guest_name is not null
      and guest_manage_token is not null)
  ),
  constraint request_guest_name_len
    check (guest_name is null or char_length(guest_name) between 1 and 200),
  constraint request_guest_email_len
    check (guest_email is null or char_length(guest_email) between 3 and 320),
  constraint request_note_len check (note is null or char_length(note) <= 500)
);

create index tutoring_requests_date_status_idx
  on tutoring_requests(session_date, status);
create index tutoring_requests_course_idx on tutoring_requests(course_id);
create index tutoring_requests_claimed_by_idx on tutoring_requests(claimed_by)
  where claimed_by is not null;

-- One live request per person per day, whichever identity they used.
create unique index uq_request_active_per_requester_date
  on tutoring_requests(requester_id, session_date)
  where status in ('open', 'claimed', 'unclaimed') and requester_id is not null;

create unique index uq_request_active_per_guest_date
  on tutoring_requests(lower(guest_email), session_date)
  where status in ('open', 'claimed', 'unclaimed') and guest_email is not null;

-- One pointer, on the slot. No bidirectional pair to keep in sync.
alter table availability_slots
  add column origin_request_id uuid unique references tutoring_requests(id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table tutoring_requests enable row level security;

-- The requester sees their own; admins see everything; a tutor sees requests
-- for courses they're approved to tutor (that's their inbox), plus anything
-- they claimed.
create policy tutoring_requests_select_own on tutoring_requests
  for select using (requester_id = auth.uid());

create policy tutoring_requests_select_admin on tutoring_requests
  for select using (has_role('admin'));

create policy tutoring_requests_select_eligible_tutor on tutoring_requests
  for select using (
    claimed_by = auth.uid()
    or exists (
      select 1 from tutor_courses tc
      where tc.tutor_id = auth.uid()
        and tc.course_id = tutoring_requests.course_id
        and tc.status = 'approved'
    )
  );

revoke insert, update, delete on tutoring_requests from authenticated, anon;

-- ---------------------------------------------------------------------------
-- notify_course_tutors: fan out to every tutor approved for a course.
-- Internal only, like notify_user.
-- ---------------------------------------------------------------------------

create or replace function notify_course_tutors(
  p_course_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_email_subject text,
  p_email_html text,
  p_exclude uuid default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid;
  v_count int := 0;
begin
  for v_tutor in
    select tc.tutor_id from tutor_courses tc
    join profiles p on p.id = tc.tutor_id
    where tc.course_id = p_course_id
      and tc.status = 'approved'
      and p.status = 'approved'
      and (p_exclude is null or tc.tutor_id <> p_exclude)
  loop
    perform notify_user(v_tutor, p_type, p_title, p_body, p_link,
                        p_email_subject, p_email_html);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function notify_course_tutors(uuid, text, text, text, text, text, text, uuid)
  from public, anon, authenticated;

-- Which teacher hosts a course, for the "just go see them anyway" message.
create or replace function course_teacher_name(p_course_id uuid) returns text
language sql stable
set search_path = public
as $$
  select t.name
  from courses c
  join teachers t on t.subject_id = c.subject_id and t.is_active
  where c.id = p_course_id
  limit 1;
$$;

revoke all on function course_teacher_name(uuid) from public;
grant execute on function course_teacher_name(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creating a request. Shared guards live here; the two entry points differ
-- only in identity.
-- ---------------------------------------------------------------------------

create or replace function assert_request_allowed(p_course_id uuid, p_date date)
returns void
language plpgsql stable
set search_path = public
as $$
begin
  if p_date < club_today() then
    raise exception 'date_in_past';
  end if;
  if not is_school_day(p_date) then
    raise exception 'not_a_school_day';
  end if;
  if not course_hosts_on(p_course_id, p_date) then
    raise exception 'teacher_not_hosting';
  end if;
  -- The whole point of the noon cutoff: tutors need warning before 12:15.
  if now() >= request_cutoff_at(p_date) then
    raise exception 'past_request_cutoff';
  end if;
end;
$$;

revoke all on function assert_request_allowed(uuid, date) from public, anon, authenticated;

create or replace function create_tutor_request(
  p_course_id uuid, p_session_date date, p_note text default null
)
returns tutoring_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_req tutoring_requests%rowtype;
  v_course text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not is_approved() then raise exception 'not_approved'; end if;
  perform assert_request_allowed(p_course_id, p_session_date);

  insert into tutoring_requests (course_id, session_date, requester_id, note)
    values (p_course_id, p_session_date, auth.uid(),
            nullif(trim(coalesce(p_note, '')), ''))
    returning * into v_req;

  select name into v_course from courses where id = p_course_id;

  perform notify_course_tutors(
    p_course_id, 'request_posted', 'A tutee needs a tutor',
    format('%s on %s — claim it if you can make it.', v_course,
      to_char(p_session_date, 'Dy FMMon FMDD')),
    '/requests', 'A tutee needs a ' || v_course || ' tutor',
    format('<p>A tutee asked for help with <strong>%s</strong> on %s at 12:15.</p><p>Open the requests page to claim it.</p>',
      v_course, to_char(p_session_date, 'Dy FMMon FMDD'))
  );

  return v_req;
exception
  when unique_violation then
    raise exception 'already_requested_that_day';
end;
$$;

revoke all on function create_tutor_request(uuid, date, text) from public, anon;
grant execute on function create_tutor_request(uuid, date, text) to authenticated;

create or replace function create_tutor_request_as_guest(
  p_course_id uuid, p_session_date date, p_name text, p_email text,
  p_note text default null
)
returns tutoring_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_req tutoring_requests%rowtype;
  v_name text := trim(p_name);
  v_email text := lower(trim(p_email));
  v_course text;
  v_teacher text;
begin
  if v_name = '' or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid_guest_details';
  end if;
  perform assert_request_allowed(p_course_id, p_session_date);

  insert into tutoring_requests (
    course_id, session_date, guest_name, guest_email, guest_manage_token, note
  ) values (
    p_course_id, p_session_date, v_name, v_email, gen_random_uuid(),
    nullif(trim(coalesce(p_note, '')), '')
  ) returning * into v_req;

  select name into v_course from courses where id = p_course_id;
  v_teacher := course_teacher_name(p_course_id);

  -- Say up front that an unclaimed request still has a fallback, so nobody
  -- is left wondering on the day.
  perform notify_guest_email(
    v_email, 'Request posted — we''ll email you when a tutor claims it',
    format('<p>You asked for help with <strong>%s</strong> on %s at 12:15.</p><p>We''ll email you as soon as a tutor claims it. If nobody does, you can still go straight to <strong>%s</strong> at 12:15 — they host that day either way.</p>',
      v_course, to_char(p_session_date, 'Dy FMMon FMDD'),
      coalesce(v_teacher, 'your teacher')),
    '/request/manage/' || v_req.id || '?t=' || v_req.guest_manage_token
  );

  perform notify_course_tutors(
    p_course_id, 'request_posted', 'A tutee needs a tutor',
    format('%s on %s — claim it if you can make it.', v_course,
      to_char(p_session_date, 'Dy FMMon FMDD')),
    '/requests', 'A tutee needs a ' || v_course || ' tutor',
    format('<p>A tutee asked for help with <strong>%s</strong> on %s at 12:15.</p><p>Open the requests page to claim it.</p>',
      v_course, to_char(p_session_date, 'Dy FMMon FMDD'))
  );

  return v_req;
exception
  when unique_violation then
    raise exception 'already_requested_that_day';
end;
$$;

revoke all on function create_tutor_request_as_guest(uuid, date, text, text, text) from public;
grant execute on function create_tutor_request_as_guest(uuid, date, text, text, text) to anon;

-- ---------------------------------------------------------------------------
-- claim_request: turns a ticket into a real session, atomically.
--
-- p_late distinguishes the two doors. The normal door closes at noon so
-- tutors get warning. The late door exists because a tutor sometimes just
-- turns up and helps anyway, and that session should still be recordable —
-- it's what their volunteer hours will hang off.
-- ---------------------------------------------------------------------------

create or replace function claim_request(p_request_id uuid)
returns availability_slots
language plpgsql security definer set search_path = public
as $$
declare
  v_req tutoring_requests%rowtype;
  v_slot availability_slots%rowtype;
  v_tutor uuid := auth.uid();
  v_subject uuid;
  v_location uuid;
  v_course text;
  v_late boolean;
begin
  if v_tutor is null then raise exception 'not_authenticated'; end if;
  if not is_approved() then raise exception 'not_approved'; end if;
  if not has_role('tutor') then raise exception 'not_a_tutor'; end if;

  select * into v_req from tutoring_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;

  if not exists (
    select 1 from tutor_courses
    where tutor_id = v_tutor and course_id = v_req.course_id and status = 'approved'
  ) then
    raise exception 'course_not_approved';
  end if;

  if v_req.requester_id = v_tutor then
    raise exception 'cannot_claim_own_request';
  end if;

  v_late := now() >= request_cutoff_at(v_req.session_date);

  if v_req.status = 'open' then
    if v_late then
      -- The sweep hasn't run yet but the cutoff has passed. Treat it as
      -- unclaimed rather than letting the normal door stay open past noon.
      null;
    end if;
  elsif v_req.status = 'unclaimed' then
    -- Late claim: only for the session date itself or shortly after, so a
    -- tutor can record a session they actually ran. Admin still approves the
    -- hours, which is the real check.
    if v_req.session_date < club_today() - 7 then
      raise exception 'too_late_to_claim';
    end if;
  else
    raise exception 'request_not_claimable';
  end if;

  select subject_id into v_subject from courses where id = v_req.course_id;
  select id into v_location from locations where is_active order by name limit 1;

  -- A claimed request is a one-on-one: created already full so it never
  -- shows on the public calendar as bookable.
  insert into availability_slots (
    tutor_id, subject_id, course_id, location_id, session_date,
    capacity, max_capacity, capacity_mode, help_mode, status, notes,
    origin_request_id
  ) values (
    v_tutor, v_subject, v_req.course_id, v_location, v_req.session_date,
    1, 1, 'limited', 'individual', 'full', v_req.note, v_req.id
  ) returning * into v_slot;

  -- Seat the requester directly: reserve_slot would reject a 'full' slot.
  insert into reservations (
    slot_id, tutee_id, status, guest_name, guest_email, guest_cancel_token
  ) values (
    v_slot.id, v_req.requester_id, 'booked',
    case when v_req.requester_id is null then v_req.guest_name end,
    case when v_req.requester_id is null then v_req.guest_email end,
    case when v_req.requester_id is null then gen_random_uuid() end
  );

  update tutoring_requests
    set status = 'claimed', claimed_by = v_tutor, claimed_at = now()
    where id = v_req.id;

  select name into v_course from courses where id = v_req.course_id;

  if v_req.requester_id is not null then
    perform notify_user(
      v_req.requester_id, 'request_claimed', 'A tutor claimed your request',
      format('Your %s session on %s is confirmed for 12:15.', v_course,
        to_char(v_req.session_date, 'Dy FMMon FMDD')),
      '/my-bookings', 'A tutor claimed your request',
      format('<p>Your <strong>%s</strong> request for %s was claimed. See you at 12:15.</p>',
        v_course, to_char(v_req.session_date, 'Dy FMMon FMDD')),
      null, v_slot.id
    );
  else
    perform notify_guest_email(
      v_req.guest_email, 'A tutor claimed your request',
      format('<p>Your <strong>%s</strong> request for %s was claimed. See you at 12:15.</p>',
        v_course, to_char(v_req.session_date, 'Dy FMMon FMDD')),
      '/request/manage/' || v_req.id || '?t=' || v_req.guest_manage_token,
      null, v_slot.id
    );
  end if;

  return v_slot;
exception
  when unique_violation then
    raise exception 'already_posted_that_day';
end;
$$;

revoke all on function claim_request(uuid) from public, anon;
grant execute on function claim_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- unclaim_request: the tutor backs out. Allowed until the end of the day
-- before, which is strictly earlier than the noon cutoff — so a released
-- ticket always lands back in the pool with real time left for someone else.
-- ---------------------------------------------------------------------------

create or replace function unclaim_request(p_request_id uuid)
returns tutoring_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_req tutoring_requests%rowtype;
  v_slot_id uuid;
  v_course text;
begin
  select * into v_req from tutoring_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.status <> 'claimed' then raise exception 'request_not_claimable'; end if;
  if v_req.claimed_by is distinct from auth.uid() and not has_role('admin') then
    raise exception 'not_authorized';
  end if;

  -- Tutors can cancel until the day before; admins any time.
  if not has_role('admin') and club_today() >= v_req.session_date then
    raise exception 'too_late_to_cancel';
  end if;

  select id into v_slot_id from availability_slots where origin_request_id = v_req.id;
  if v_slot_id is not null then
    -- Cascades reservation cancellation and notifies the seated tutee.
    perform cancel_slot(v_slot_id);
    update availability_slots set origin_request_id = null where id = v_slot_id;
  end if;

  update tutoring_requests
    set status = case when now() < request_cutoff_at(session_date)
                      then 'open' else 'unclaimed' end,
        claimed_by = null, claimed_at = null
    where id = v_req.id
    returning * into v_req;

  select name into v_course from courses where id = v_req.course_id;

  if v_req.status = 'open' then
    perform notify_course_tutors(
      v_req.course_id, 'request_posted', 'A request is open again',
      format('%s on %s needs a tutor.', v_course,
        to_char(v_req.session_date, 'Dy FMMon FMDD')),
      '/requests', 'A ' || v_course || ' request is open again',
      format('<p>A <strong>%s</strong> request for %s is looking for a tutor again.</p>',
        v_course, to_char(v_req.session_date, 'Dy FMMon FMDD'))
    );
  end if;

  return v_req;
end;
$$;

revoke all on function unclaim_request(uuid) from public, anon;
grant execute on function unclaim_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancelling a request (the tutee's side).
-- ---------------------------------------------------------------------------

create or replace function cancel_tutor_request(p_request_id uuid)
returns tutoring_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_req tutoring_requests%rowtype;
  v_slot_id uuid;
begin
  select * into v_req from tutoring_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.requester_id is distinct from auth.uid() and not has_role('admin') then
    raise exception 'not_authorized';
  end if;
  if v_req.status = 'cancelled' then raise exception 'request_not_claimable'; end if;

  select id into v_slot_id from availability_slots where origin_request_id = v_req.id;
  if v_slot_id is not null then
    perform cancel_slot(v_slot_id);
  end if;

  update tutoring_requests
    set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
    where id = v_req.id
    returning * into v_req;

  return v_req;
end;
$$;

revoke all on function cancel_tutor_request(uuid) from public, anon;
grant execute on function cancel_tutor_request(uuid) to authenticated;

create or replace function cancel_tutor_request_as_guest(
  p_request_id uuid, p_token uuid
)
returns tutoring_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_req tutoring_requests%rowtype;
  v_slot_id uuid;
begin
  select * into v_req from tutoring_requests where id = p_request_id for update;
  if not found
     or v_req.requester_id is not null
     or v_req.guest_manage_token is null
     or v_req.guest_manage_token <> p_token
  then
    raise exception 'invalid_guest_link';
  end if;
  if v_req.status = 'cancelled' then raise exception 'request_not_claimable'; end if;

  select id into v_slot_id from availability_slots where origin_request_id = v_req.id;
  if v_slot_id is not null then
    perform cancel_slot(v_slot_id);
  end if;

  update tutoring_requests
    set status = 'cancelled', cancelled_at = now()
    where id = v_req.id
    returning * into v_req;

  return v_req;
end;
$$;

revoke all on function cancel_tutor_request_as_guest(uuid, uuid) from public;
grant execute on function cancel_tutor_request_as_guest(uuid, uuid) to anon;

create or replace function get_request_for_guest(p_request_id uuid, p_token uuid)
returns table (
  id uuid, status text, session_date date, course_name text,
  teacher_name text, guest_name text, note text, tutor_name text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_req tutoring_requests%rowtype;
begin
  select * into v_req from tutoring_requests r where r.id = p_request_id;
  if not found
     or v_req.requester_id is not null
     or v_req.guest_manage_token is null
     or v_req.guest_manage_token <> p_token
  then
    raise exception 'invalid_guest_link';
  end if;

  return query
    select v_req.id, v_req.status, v_req.session_date, c.name,
           course_teacher_name(v_req.course_id), v_req.guest_name, v_req.note,
           tp.full_name
    from courses c
    left join profiles tp on tp.id = v_req.claimed_by
    where c.id = v_req.course_id;
end;
$$;

revoke all on function get_request_for_guest(uuid, uuid) from public;
grant execute on function get_request_for_guest(uuid, uuid) to anon;

-- ---------------------------------------------------------------------------
-- mark_unclaimed_requests: the noon sweep.
--
-- Deliberately NOT an expiry. The ticket stays on the calendar as
-- `unclaimed` so the tutee can see what happened, and so a tutor who turns
-- up anyway can still claim it late. All this does is close the advance
-- signup window and tell the tutee about the fallback.
-- ---------------------------------------------------------------------------

create or replace function mark_unclaimed_requests()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_teacher text;
begin
  for r in
    select tr.id, tr.course_id, tr.session_date, tr.requester_id,
           tr.guest_email, tr.guest_manage_token, c.name as course_name
    from tutoring_requests tr
    join courses c on c.id = tr.course_id
    where tr.status = 'open'
      and now() >= request_cutoff_at(tr.session_date)
    for update of tr
  loop
    update tutoring_requests set status = 'unclaimed' where id = r.id;
    v_teacher := coalesce(course_teacher_name(r.course_id), 'your teacher');

    if r.requester_id is not null then
      perform notify_user(
        r.requester_id, 'request_unclaimed', 'No tutor claimed your request',
        format('Nobody claimed your %s request for %s — you can still go straight to %s at 12:15.',
          r.course_name, to_char(r.session_date, 'Dy FMMon FMDD'), v_teacher),
        '/my-bookings', 'No tutor claimed your request — but you can still go',
        format('<p>Nobody claimed your <strong>%s</strong> request for %s.</p><p>You can still go straight to <strong>%s</strong> at 12:15 — they host tutoring that day regardless. A tutor may still pick it up on the day.</p>',
          r.course_name, to_char(r.session_date, 'Dy FMMon FMDD'), v_teacher)
      );
    else
      perform notify_guest_email(
        r.guest_email, 'No tutor claimed your request — but you can still go',
        format('<p>Nobody claimed your <strong>%s</strong> request for %s.</p><p>You can still go straight to <strong>%s</strong> at 12:15 — they host tutoring that day regardless. A tutor may still pick it up on the day.</p>',
          r.course_name, to_char(r.session_date, 'Dy FMMon FMDD'), v_teacher),
        '/request/manage/' || r.id || '?t=' || r.guest_manage_token
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function mark_unclaimed_requests() from public, anon, authenticated;
grant execute on function mark_unclaimed_requests() to service_role;

-- ---------------------------------------------------------------------------
-- Public read of live requests, so the calendar can show them alongside
-- sessions. Names are withheld from anon — a request reveals that a named
-- student needs help with a subject, which is nobody else's business.
-- ---------------------------------------------------------------------------

create or replace function get_public_requests()
returns table (
  id uuid, session_date date, course_name text, subject_name text,
  teacher_name text, status text, claimable boolean
)
language sql stable security definer set search_path = public
as $$
  select tr.id, tr.session_date, c.name, s.name,
         course_teacher_name(tr.course_id), tr.status,
         (tr.status = 'open' and now() < request_cutoff_at(tr.session_date))
  from tutoring_requests tr
  join courses c on c.id = tr.course_id
  join subjects s on s.id = c.subject_id
  where tr.status in ('open', 'unclaimed')
    and tr.session_date >= club_today()
  order by tr.session_date asc;
$$;

revoke all on function get_public_requests() from public;
grant execute on function get_public_requests() to anon, authenticated;
