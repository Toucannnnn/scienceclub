-- Admins can grant a course directly, and revoke one.
--
-- decide_tutor_course (0008) only UPDATEs an existing row, so the whole
-- approval flow was tutor-initiated: an admin setting the club up had to
-- chase every tutor to log in and request first, and until they did the
-- approval queue just read "No course requests waiting". These two RPCs let
-- an admin start it, without removing the request queue.

-- ---------------------------------------------------------------------------
-- 'revoked' is its own state. Taking a course back from a tutor who was
-- doing it is not the same event as declining a request they made, and
-- collapsing the two would show them "Declined" for something they had.
-- ---------------------------------------------------------------------------

alter table tutor_courses drop constraint tutor_courses_status_check;
alter table tutor_courses add constraint tutor_courses_status_check
  check (status in ('pending', 'approved', 'rejected', 'revoked'));

-- ---------------------------------------------------------------------------
-- grant_tutor_course: approve a course with no request needed. Works from
-- any prior state — none, pending, rejected or revoked.
-- ---------------------------------------------------------------------------

create or replace function grant_tutor_course(p_tutor_id uuid, p_course_id uuid)
returns tutor_courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row tutor_courses%rowtype;
  v_course_name text;
begin
  if not has_role('admin') then
    raise exception 'not_authorized';
  end if;

  -- Without this an admin could hand teaching rights to a tutee.
  if not exists (
    select 1 from user_roles
    where user_id = p_tutor_id and role_code = 'tutor'
  ) then
    raise exception 'not_a_tutor';
  end if;

  select name into v_course_name from courses
    where id = p_course_id and is_active;
  if v_course_name is null then
    raise exception 'course_not_found';
  end if;

  insert into tutor_courses (tutor_id, course_id, status, decided_by, decided_at)
    values (p_tutor_id, p_course_id, 'approved', auth.uid(), now())
  on conflict (tutor_id, course_id) do update
    set status = 'approved',
        decided_by = auth.uid(),
        decided_at = now()
  returning * into v_row;

  perform notify_user(
    p_tutor_id, 'course_approved', 'Course approved',
    format('You''re approved to tutor %s.', v_course_name),
    '/tutor/courses',
    'You''re approved to tutor ' || v_course_name,
    format('<p>You''re now approved to tutor <strong>%s</strong>. You can post availability for it right away.</p>',
      v_course_name)
  );

  return v_row;
end;
$$;

revoke all on function grant_tutor_course(uuid, uuid) from public, anon;
grant execute on function grant_tutor_course(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_tutor_course: take a course back.
--
-- Deliberately does NOT cascade. create_slot gates on status = 'approved',
-- so revoking stops *new* sessions immediately, while sessions already
-- posted stay exactly as they are — tutees have booked those, and silently
-- cancelling them because of an admin bookkeeping change would be worse
-- than the problem. Cancel them individually if that's really the intent.
-- ---------------------------------------------------------------------------

create or replace function revoke_tutor_course(p_tutor_id uuid, p_course_id uuid)
returns tutor_courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row tutor_courses%rowtype;
  v_course_name text;
begin
  if not has_role('admin') then
    raise exception 'not_authorized';
  end if;

  update tutor_courses
    set status = 'revoked',
        decided_by = auth.uid(),
        decided_at = now()
    where tutor_id = p_tutor_id and course_id = p_course_id
    returning * into v_row;

  if not found then
    raise exception 'request_not_found';
  end if;

  select name into v_course_name from courses where id = p_course_id;

  perform notify_user(
    p_tutor_id, 'course_revoked', 'Course removed',
    format('You''re no longer listed to tutor %s. Sessions you''ve already posted are unaffected.',
      v_course_name),
    '/tutor/courses',
    'A course was removed from your list',
    format('<p>You''re no longer listed to tutor <strong>%s</strong>, so you can''t post new sessions for it.</p><p>Anything you''ve already posted still stands. Ask an admin if this looks wrong.</p>',
      v_course_name)
  );

  return v_row;
end;
$$;

revoke all on function revoke_tutor_course(uuid, uuid) from public, anon;
grant execute on function revoke_tutor_course(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A revoked tutor can ask for the course again — that puts it back in the
-- admin queue for review, so it isn't a way around the revoke.
-- ---------------------------------------------------------------------------

create or replace function request_tutor_courses(p_course_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := auth.uid();
  v_count int;
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

  insert into tutor_courses (tutor_id, course_id, status, requested_at)
  select v_tutor, c.id, 'pending', now()
  from courses c
  where c.id = any(p_course_ids) and c.is_active
  on conflict (tutor_id, course_id) do update
    set status = 'pending',
        requested_at = now(),
        decided_by = null,
        decided_at = null
    where tutor_courses.status in ('rejected', 'revoked');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_tutor_courses: every active course with this tutor's standing
-- against it, so the tutor detail screen is one round trip.
-- ---------------------------------------------------------------------------

create or replace function admin_get_tutor_courses(p_tutor_id uuid)
returns table (
  course_id uuid,
  course_name text,
  subject_name text,
  status text,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_role('admin') then
    raise exception 'not_authorized';
  end if;

  return query
    select c.id, c.name, s.name, tc.status, tc.decided_at
    from courses c
    join subjects s on s.id = c.subject_id
    left join tutor_courses tc
      on tc.course_id = c.id and tc.tutor_id = p_tutor_id
    where c.is_active
    order by s.name, c.sort_order;
end;
$$;

revoke all on function admin_get_tutor_courses(uuid) from public, anon;
grant execute on function admin_get_tutor_courses(uuid) to authenticated;
