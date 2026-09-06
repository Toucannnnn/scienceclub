-- Stage 4: the admin console's read layer, and account-free booking lookup.

-- ---------------------------------------------------------------------------
-- admin_overview: the queue counts on /admin. One round trip instead of six.
-- ---------------------------------------------------------------------------

create or replace function admin_overview()
returns table (
  pending_users int, pending_courses int, pending_hours int,
  open_requests int, unclaimed_requests int, upcoming_sessions int,
  approved_hours numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not has_role('admin') then raise exception 'not_authorized'; end if;

  return query select
    (select count(*)::int from profiles where status = 'pending'),
    (select count(*)::int from tutor_courses where status = 'pending'),
    (select count(*)::int from volunteer_hours where status = 'submitted'),
    (select count(*)::int from tutoring_requests where status = 'open'),
    (select count(*)::int from tutoring_requests where status = 'unclaimed'),
    (select count(*)::int from availability_slots
       where session_date >= club_today() and status in ('open', 'full')),
    (select coalesce(sum(hours), 0) from volunteer_hours where status = 'approved');
end;
$$;

revoke all on function admin_overview() from public, anon;
grant execute on function admin_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_tutor_roster: every tutor, what they're cleared to teach, how much
-- they've actually done. Aggregation, so an RPC rather than a PostgREST
-- embed.
-- ---------------------------------------------------------------------------

create or replace function admin_tutor_roster()
returns table (
  tutor_id uuid, tutor_name text, tutor_email text, status text,
  approved_courses text[], pending_courses int,
  sessions_held int, approved_hours numeric, pending_hours numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not has_role('admin') then raise exception 'not_authorized'; end if;

  return query
    select p.id, p.full_name, p.email, p.status,
      coalesce((select array_agg(c.name order by c.name)
                from tutor_courses tc join courses c on c.id = tc.course_id
                where tc.tutor_id = p.id and tc.status = 'approved'), '{}'),
      (select count(*)::int from tutor_courses tc
       where tc.tutor_id = p.id and tc.status = 'pending'),
      (select count(*)::int from availability_slots s
       where s.tutor_id = p.id and s.status <> 'cancelled'),
      (select coalesce(sum(vh.hours), 0) from volunteer_hours vh
       where vh.tutor_id = p.id and vh.status = 'approved'),
      (select coalesce(sum(vh.hours), 0) from volunteer_hours vh
       where vh.tutor_id = p.id and vh.status = 'submitted')
    from profiles p
    join user_roles ur on ur.user_id = p.id and ur.role_code = 'tutor'
    order by p.full_name;
end;
$$;

revoke all on function admin_tutor_roster() from public, anon;
grant execute on function admin_tutor_roster() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_sessions: every session, filterable and sortable. Sorting is done
-- here rather than in the client because React Compiler treats an
-- un-memoized sort as a lint error, and server-side sorting paginates and
-- shares by URL.
-- ---------------------------------------------------------------------------

create or replace function admin_sessions(
  p_status text default 'all',
  p_origin text default 'all',
  p_sort text default 'session_date',
  p_desc boolean default true
)
returns table (
  id uuid, session_date date, status text, tutor_name text, course_name text,
  location_name text, help_mode text, capacity_mode text, capacity int,
  booked int, from_request boolean, hours_status text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not has_role('admin') then raise exception 'not_authorized'; end if;

  return query
    select s.id, s.session_date, s.status, p.full_name, c.name, l.name,
           s.help_mode, s.capacity_mode, s.capacity,
           (select count(*)::int from reservations r
            where r.slot_id = s.id and r.status = 'booked'),
           s.origin_request_id is not null,
           vh.status
    from availability_slots s
    join profiles p on p.id = s.tutor_id
    left join courses c on c.id = s.course_id
    left join locations l on l.id = s.location_id
    left join volunteer_hours vh on vh.slot_id = s.id
    where (p_status = 'all' or s.status = p_status)
      and (p_origin = 'all'
           or (p_origin = 'request' and s.origin_request_id is not null)
           or (p_origin = 'posted' and s.origin_request_id is null))
    order by
      case when p_desc then
        case p_sort when 'tutor' then p.full_name
                    when 'course' then c.name
                    when 'status' then s.status
                    else s.session_date::text end
      end desc nulls last,
      case when not p_desc then
        case p_sort when 'tutor' then p.full_name
                    when 'course' then c.name
                    when 'status' then s.status
                    else s.session_date::text end
      end asc nulls last;
end;
$$;

revoke all on function admin_sessions(text, text, text, boolean) from public, anon;
grant execute on function admin_sessions(text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_requests: the ticket board, any status.
-- ---------------------------------------------------------------------------

create or replace function admin_requests(p_status text default 'all')
returns table (
  id uuid, session_date date, status text, course_name text,
  requester_name text, requester_email text, tutor_name text,
  note text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not has_role('admin') then raise exception 'not_authorized'; end if;

  return query
    select tr.id, tr.session_date, tr.status, c.name,
           coalesce(rp.full_name, tr.guest_name),
           coalesce(rp.email, tr.guest_email),
           tp.full_name, tr.note, tr.created_at
    from tutoring_requests tr
    join courses c on c.id = tr.course_id
    left join profiles rp on rp.id = tr.requester_id
    left join profiles tp on tp.id = tr.claimed_by
    where p_status = 'all' or tr.status = p_status
    order by tr.session_date desc, tr.created_at desc;
end;
$$;

revoke all on function admin_requests(text) from public, anon;
grant execute on function admin_requests(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Account-free booking lookup.
--
-- Two doors, by explicit product decision:
--
--   1. Instant  — type an email, see that email's bookings immediately.
--      School addresses are guessable (firstname.lastname.###@…), so this
--      is enumerable by design. It is therefore strictly READ-ONLY and
--      deliberately omits guest_cancel_token: someone who guesses an
--      address can see a session exists, but cannot cancel it.
--
--   2. Emailed link — a one-time token that returns the same rows *plus*
--      the cancel tokens, so managing a booking requires control of the
--      inbox.
--
-- send_booking_lookup_link is anon-callable and sends mail from the club's
-- domain, so it is throttled. Without that it would be a worse open relay
-- than the one closed in 0009 — this one is reachable by design.
-- ---------------------------------------------------------------------------

create table booking_lookup_tokens (
  token uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz
);

create index booking_lookup_email_idx on booking_lookup_tokens(email, created_at desc);

-- No policies at all: definer-only, following the email_outbox pattern.
alter table booking_lookup_tokens enable row level security;
revoke all on booking_lookup_tokens from anon, authenticated;

create or replace function get_bookings_by_email(p_email text)
returns table (
  session_date date, status text, course_name text, tutor_name text,
  location_name text, booked_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select s.session_date, r.status, c.name, p.full_name, l.name, r.booked_at
  from reservations r
  join availability_slots s on s.id = r.slot_id
  join profiles p on p.id = s.tutor_id
  left join courses c on c.id = s.course_id
  left join locations l on l.id = s.location_id
  where lower(r.guest_email) = lower(trim(p_email))
  order by s.session_date desc;
$$;

revoke all on function get_bookings_by_email(text) from public;
grant execute on function get_bookings_by_email(text) to anon, authenticated;

create or replace function send_booking_lookup_link(p_email text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_token uuid;
  v_has_bookings boolean;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    -- Return silently either way: never confirm whether an address is valid.
    return;
  end if;

  -- Per-address cooldown, so one address can't be used to mailbomb someone.
  if exists (
    select 1 from booking_lookup_tokens
    where email = v_email and created_at > now() - interval '5 minutes'
  ) then
    return;
  end if;

  -- Site-wide ceiling, so the endpoint can't be used to burn the club's
  -- sending reputation.
  if (select count(*) from booking_lookup_tokens
      where created_at > now() - interval '1 hour') >= 50 then
    return;
  end if;

  select exists (
    select 1 from reservations where lower(guest_email) = v_email
  ) into v_has_bookings;

  -- Only actually send if there's something to look at, but return the same
  -- (nothing) regardless, so the caller learns nothing.
  if not v_has_bookings then
    return;
  end if;

  insert into booking_lookup_tokens (email) values (v_email)
    returning token into v_token;

  perform notify_guest_email(
    v_email, 'Your Science All Stars bookings',
    '<p>Here are your tutoring bookings. This link works for 24 hours and lets you cancel if you need to.</p>',
    '/lookup/' || v_token
  );
end;
$$;

revoke all on function send_booking_lookup_link(text) from public;
grant execute on function send_booking_lookup_link(text) to anon, authenticated;

create or replace function get_bookings_by_lookup_token(p_token uuid)
returns table (
  reservation_id uuid, session_date date, status text, course_name text,
  tutor_name text, location_name text, cancel_token uuid
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from booking_lookup_tokens
    where token = p_token and expires_at > now();
  if v_email is null then
    raise exception 'invalid_guest_link';
  end if;

  return query
    select r.id, s.session_date, r.status, c.name, p.full_name, l.name,
           r.guest_cancel_token
    from reservations r
    join availability_slots s on s.id = r.slot_id
    join profiles p on p.id = s.tutor_id
    left join courses c on c.id = s.course_id
    left join locations l on l.id = s.location_id
    where lower(r.guest_email) = v_email
    order by s.session_date desc;
end;
$$;

revoke all on function get_bookings_by_lookup_token(uuid) from public;
grant execute on function get_bookings_by_lookup_token(uuid) to anon, authenticated;
