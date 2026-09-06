-- Stage 3: volunteer hours with photo proof.
--
-- From 12:15 on the session date, the tutor who ran a session uploads a
-- photo as proof and it lands in an admin review queue. Approved rows are
-- the club's volunteer-hour ledger.
--
-- One row per *slot*, not per reservation: a tutor running a group session
-- for four tutees earns the half hour once, not four times. Because claiming
-- a request materializes a real slot (0011), hours link only to slots —
-- there is no polymorphic (slot_id, request_id) pair anywhere, and no CASE
-- in the export query.

create table volunteer_hours (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references availability_slots(id) on delete cascade,
  tutor_id uuid not null references profiles(id) on delete cascade,
  -- Denormalized from the slot so the ledger stays sortable and exportable
  -- without a join, and survives a slot being re-dated.
  session_date date not null,
  hours numeric(4,2) not null default 0.5
    check (hours > 0 and hours <= 8),
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected')),
  proof_object_path text,
  tutor_note text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index volunteer_hours_tutor_date_idx
  on volunteer_hours(tutor_id, session_date desc);
create index volunteer_hours_pending_idx on volunteer_hours(submitted_at)
  where status = 'submitted';

alter table volunteer_hours enable row level security;

create policy volunteer_hours_select_own on volunteer_hours
  for select using (tutor_id = auth.uid());
create policy volunteer_hours_select_admin on volunteer_hours
  for select using (has_role('admin'));

revoke insert, update, delete on volunteer_hours from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Proof photos live in a private bucket. Never public: these are photos from
-- a high school club, and a public bucket means a guessable URL is a leak.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-proofs', 'session-proofs', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Object path is {tutor_id}/{slot_id}/{uuid}.{ext}. The first segment being
-- the owner's UUID is what makes these policies expressible.
--
-- public.has_role, schema-qualified: storage policies do not run with
-- `public` in search_path, so an unqualified call fails at evaluation time.

create policy proofs_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_role('tutor')
  );

create policy proofs_select_own_or_admin on storage.objects for select to authenticated
  using (
    bucket_id = 'session-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role('admin')
    )
  );

create policy proofs_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'session-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- notify_admins: fan out to everyone holding the admin role. Internal only.
-- ---------------------------------------------------------------------------

create or replace function notify_admins(
  p_type text, p_title text, p_body text, p_link text,
  p_email_subject text, p_email_html text
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_admin uuid;
  v_count int := 0;
begin
  for v_admin in
    select ur.user_id from user_roles ur
    join profiles p on p.id = ur.user_id
    where ur.role_code = 'admin' and p.status = 'approved'
  loop
    perform notify_user(v_admin, p_type, p_title, p_body, p_link,
                        p_email_subject, p_email_html);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function notify_admins(text, text, text, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_session_hours: the tutor logs a session they ran.
--
-- Open-ended forward from 12:15 on the day, so past sessions can still be
-- submitted from the availability page — that's the whole point of the
-- Past/Today/Upcoming split. Resubmitting after a rejection is allowed;
-- an approved row is immutable to the tutor.
-- ---------------------------------------------------------------------------

create or replace function submit_session_hours(
  p_slot_id uuid, p_object_path text default null, p_note text default null
)
returns volunteer_hours
language plpgsql security definer set search_path = public
as $$
declare
  v_slot availability_slots%rowtype;
  v_row volunteer_hours%rowtype;
  v_tutor uuid := auth.uid();
  v_tutor_name text;
  v_course text;
begin
  if v_tutor is null then raise exception 'not_authenticated'; end if;

  select * into v_slot from availability_slots where id = p_slot_id;
  if not found then raise exception 'slot_not_found'; end if;
  if v_slot.tutor_id <> v_tutor then raise exception 'not_authorized'; end if;
  if v_slot.status = 'cancelled' then raise exception 'slot_cancelled'; end if;
  if now() < session_starts_at(v_slot.session_date) then
    raise exception 'session_not_started';
  end if;

  -- Without this a tutor could point their own hours row at somebody else's
  -- photo, since the object path arrives from the client.
  if p_object_path is not null
     and split_part(p_object_path, '/', 1) <> v_tutor::text then
    raise exception 'invalid_proof_path';
  end if;

  insert into volunteer_hours (
    slot_id, tutor_id, session_date, proof_object_path, tutor_note
  ) values (
    p_slot_id, v_tutor, v_slot.session_date, p_object_path,
    nullif(trim(coalesce(p_note, '')), '')
  )
  on conflict (slot_id) do update
    set proof_object_path = coalesce(excluded.proof_object_path,
                                     volunteer_hours.proof_object_path),
        tutor_note = excluded.tutor_note,
        status = 'submitted',
        submitted_at = now(),
        reviewed_by = null, reviewed_at = null, review_note = null
    where volunteer_hours.status <> 'approved'
  returning * into v_row;

  if not found then raise exception 'hours_already_approved'; end if;

  update availability_slots set status = 'completed'
    where id = p_slot_id and status in ('open', 'full');

  select full_name into v_tutor_name from profiles where id = v_tutor;
  select name into v_course from courses where id = v_slot.course_id;

  perform notify_admins(
    'hours_submitted', 'Hours submitted for review',
    format('%s logged %s on %s.', v_tutor_name, coalesce(v_course, 'a session'),
      to_char(v_slot.session_date, 'Dy FMMon FMDD')),
    '/admin/hours', 'Tutoring hours need review',
    format('<p><strong>%s</strong> submitted hours for %s on %s.</p>',
      v_tutor_name, coalesce(v_course, 'a session'),
      to_char(v_slot.session_date, 'Dy FMMon FMDD'))
  );

  return v_row;
end;
$$;

revoke all on function submit_session_hours(uuid, text, text) from public, anon;
grant execute on function submit_session_hours(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- review_session_hours: admin approves or rejects, optionally adjusting the
-- hours (a session that ran long, or didn't happen at all).
-- ---------------------------------------------------------------------------

create or replace function review_session_hours(
  p_hours_id uuid, p_approve boolean, p_hours numeric default null,
  p_note text default null
)
returns volunteer_hours
language plpgsql security definer set search_path = public
as $$
declare
  v_row volunteer_hours%rowtype;
begin
  if not has_role('admin') then raise exception 'not_authorized'; end if;

  update volunteer_hours
    set status = case when p_approve then 'approved' else 'rejected' end,
        hours = coalesce(p_hours, hours),
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = nullif(trim(coalesce(p_note, '')), '')
    where id = p_hours_id
    returning * into v_row;

  if not found then raise exception 'hours_not_found'; end if;

  perform notify_user(
    v_row.tutor_id,
    case when p_approve then 'hours_approved' else 'hours_rejected' end,
    case when p_approve then 'Hours approved' else 'Hours need another look' end,
    case when p_approve
      then format('%s hours approved for %s.', v_row.hours,
        to_char(v_row.session_date, 'Dy FMMon FMDD'))
      else format('Your hours for %s weren''t approved. %s',
        to_char(v_row.session_date, 'Dy FMMon FMDD'),
        coalesce(v_row.review_note, 'Ask an admin for details.'))
    end,
    '/hours',
    case when p_approve then 'Your tutoring hours were approved'
         else 'Your tutoring hours need another look' end,
    case when p_approve
      then format('<p><strong>%s hours</strong> approved for %s.</p>',
        v_row.hours, to_char(v_row.session_date, 'Dy FMMon FMDD'))
      else format('<p>Your hours for %s weren''t approved.</p><p>%s</p>',
        to_char(v_row.session_date, 'Dy FMMon FMDD'),
        coalesce(v_row.review_note, 'Ask an admin for details.'))
    end
  );

  return v_row;
end;
$$;

revoke all on function review_session_hours(uuid, boolean, numeric, text)
  from public, anon;
grant execute on function review_session_hours(uuid, boolean, numeric, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Read helpers.
-- ---------------------------------------------------------------------------

-- The admin review queue, joined so the screen is one round trip.
create or replace function get_hours_for_review(p_status text default 'submitted')
returns table (
  id uuid, tutor_id uuid, tutor_name text, tutor_email text,
  session_date date, course_name text, hours numeric, status text,
  proof_object_path text, tutor_note text, submitted_at timestamptz,
  reviewed_at timestamptz, review_note text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not has_role('admin') then raise exception 'not_authorized'; end if;

  return query
    select vh.id, vh.tutor_id, p.full_name, p.email, vh.session_date, c.name,
           vh.hours, vh.status, vh.proof_object_path, vh.tutor_note,
           vh.submitted_at, vh.reviewed_at, vh.review_note
    from volunteer_hours vh
    join profiles p on p.id = vh.tutor_id
    join availability_slots s on s.id = vh.slot_id
    left join courses c on c.id = s.course_id
    where p_status = 'all' or vh.status = p_status
    order by vh.submitted_at desc;
end;
$$;

revoke all on function get_hours_for_review(text) from public, anon;
grant execute on function get_hours_for_review(text) to authenticated;

-- A tutor's own ledger, for their hours page and CSV export. RLS on
-- volunteer_hours would cover the rows, but the course name needs a join
-- through availability_slots, so this keeps it to one call.
create or replace function get_my_hours()
returns table (
  id uuid, session_date date, course_name text, help_mode text,
  attendees int, hours numeric, status text, submitted_at timestamptz,
  reviewed_at timestamptz, review_note text
)
language sql stable security definer set search_path = public
as $$
  select vh.id, vh.session_date, c.name, s.help_mode,
         (select count(*)::int from reservations r
          where r.slot_id = vh.slot_id and r.status = 'booked'),
         vh.hours, vh.status, vh.submitted_at, vh.reviewed_at, vh.review_note
  from volunteer_hours vh
  join availability_slots s on s.id = vh.slot_id
  left join courses c on c.id = s.course_id
  where vh.tutor_id = auth.uid()
  order by vh.session_date desc;
$$;

revoke all on function get_my_hours() from public, anon;
grant execute on function get_my_hours() to authenticated;
