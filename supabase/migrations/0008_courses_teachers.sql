-- Stage 1 of the club-operations rebuild: the real domain model.
--
-- Until now `subjects` had zero rows (so the subject dropdown has always been
-- empty), there was no notion of a course level, no notion of the teachers
-- who actually host tutoring, and no record of what a tutor is cleared to
-- teach. This adds all four, plus a security fix that can't wait.

-- ---------------------------------------------------------------------------
-- SECURITY FIX — an open email relay.
--
-- Every other function in this schema is explicitly revoked from PUBLIC, but
-- these four never were. PostgREST exposes any function the caller's role can
-- execute, and notify_user() is SECURITY DEFINER — so *anonymous* callers
-- could insert arbitrary rows into email_outbox, which the cron dispatcher
-- then sends through Resend from the club's own domain. That is a spam and
-- phishing relay pointed at this project's sending reputation.
--
-- Nothing breaks: the RPCs that legitimately use these call them as the
-- function owner, and an owner needs no EXECUTE grant on its own objects.
--
-- has_role() and is_approved() are deliberately NOT revoked — they're
-- evaluated inside RLS policy expressions, which run with the *caller's*
-- privileges, so revoking them would break every policy in the database.
-- They're also harmless to expose: both answer only about auth.uid(), i.e.
-- about the caller themselves.
-- ---------------------------------------------------------------------------

revoke all on function notify_user(uuid, text, text, text, text, text, text, uuid, uuid) from public;
revoke all on function notify_guest_email(text, text, text, text, uuid, uuid) from public;
revoke all on function get_slot_context(uuid, uuid) from public;
revoke all on function has_active_restriction(uuid) from public;

-- ---------------------------------------------------------------------------
-- Subjects — seeding the table that 0001 created and never filled.
-- ---------------------------------------------------------------------------

insert into subjects (name) values
  ('Biology'),
  ('Chemistry'),
  ('Physics'),
  ('Environmental Science'),
  ('Psychology')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- courses: the level a tutor is actually approved to teach. "Biology" and
-- "AP Biology" are very different asks, so approval is per course, not per
-- subject.
-- ---------------------------------------------------------------------------

create table courses (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

create index courses_subject_idx on courses(subject_id) where is_active;

insert into courses (subject_id, name, sort_order)
select s.id, c.name, c.sort_order
from subjects s
join (values
  ('Biology',               'Biology',                  1),
  ('Biology',               'Biology Advanced',         2),
  ('Biology',               'AP Biology',               3),
  ('Chemistry',             'Chemistry',                1),
  ('Chemistry',             'Chemistry Advanced',       2),
  ('Chemistry',             'AP Chemistry',             3),
  ('Physics',               'Physics 1',                1),
  ('Physics',               'AP Physics 1',             2),
  ('Physics',               'AP Physics 2',             3),
  ('Physics',               'AP Physics C',             4),
  ('Environmental Science', 'AP Environmental Science', 1),
  ('Psychology',            'AP Psychology',            1)
) as c(subject, name, sort_order) on c.subject = s.name
on conflict (subject_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- teachers: who hosts tutoring, and on which weekdays. Sessions only exist on
-- days a teacher is open, so this table drives the whole calendar.
--
-- weekdays is an array rather than a join table because there are five
-- teachers and the only question ever asked is "who hosts on date D" —
-- `where weekdays @> array[extract(dow from D)]` answers that in one hop.
-- ---------------------------------------------------------------------------

create table teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject_id uuid not null references subjects(id),
  weekdays smallint[] not null,
  room text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint teacher_weekdays_valid check (
    array_length(weekdays, 1) between 1 and 7
    and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

create index teachers_weekdays_idx on teachers using gin (weekdays);

-- 0 = Sunday … 6 = Saturday, matching Postgres `extract(dow)` and JS getDay().
insert into teachers (name, subject_id, weekdays)
select t.name, s.id, t.weekdays
from subjects s
join (values
  ('Mr. Hauser',      'Biology',               array[1,3]::smallint[]),
  ('Mrs. Montgomery', 'Chemistry',             array[1,3,4]::smallint[]),
  ('Ms. Rittenhouse', 'Physics',               array[2,3,4]::smallint[]),
  ('Ms. Alejo',       'Environmental Science', array[1,2,4]::smallint[]),
  ('Mr. J',           'Psychology',            array[1,2,3]::smallint[])
) as t(name, subject, weekdays) on t.subject = s.name;

-- ---------------------------------------------------------------------------
-- tutor_courses: what each tutor is cleared to tutor, and the approval trail.
--
-- Replaces `tutor_subjects`, which 0001 created for exactly this purpose and
-- which no code has ever read or written (zero rows, zero references in src/).
-- Keeping both would leave two competing answers to "what can this tutor
-- teach", so the dead one goes.
-- ---------------------------------------------------------------------------

drop table if exists tutor_subjects;

create table tutor_courses (
  tutor_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  primary key (tutor_id, course_id)
);

create index tutor_courses_pending_idx on tutor_courses(requested_at)
  where status = 'pending';
create index tutor_courses_approved_idx on tutor_courses(course_id)
  where status = 'approved';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table courses enable row level security;
alter table teachers enable row level security;
alter table tutor_courses enable row level security;

-- Reference data: any approved member can read it; only admins change it.
create policy courses_select_approved on courses
  for select using (is_approved());
create policy courses_write_admin on courses
  for all using (has_role('admin')) with check (has_role('admin'));

create policy teachers_select_approved on teachers
  for select using (is_approved());
create policy teachers_write_admin on teachers
  for all using (has_role('admin')) with check (has_role('admin'));

-- A tutor sees their own approvals; admins see everyone's. All writes go
-- through the RPCs below, so there is no insert/update/delete policy.
create policy tutor_courses_select_own on tutor_courses
  for select using (tutor_id = auth.uid());
create policy tutor_courses_select_admin on tutor_courses
  for select using (has_role('admin'));

revoke insert, update, delete on tutor_courses from authenticated, anon;

-- ---------------------------------------------------------------------------
-- request_tutor_courses: a tutor asks to be approved for a set of courses.
-- Re-requesting a rejected course resets it to pending; an already-approved
-- course is left alone so a stray re-request can't revoke someone.
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
    where tutor_courses.status = 'rejected';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function request_tutor_courses(uuid[]) from public;
grant execute on function request_tutor_courses(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- withdraw_tutor_course: a tutor removes a course they no longer want to
-- tutor (or withdraws a pending request). Approved rows can be withdrawn too
-- — this is the tutor stepping back, not an admin revoking.
-- ---------------------------------------------------------------------------

create or replace function withdraw_tutor_course(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from tutor_courses
    where tutor_id = auth.uid() and course_id = p_course_id;
end;
$$;

revoke all on function withdraw_tutor_course(uuid) from public;
grant execute on function withdraw_tutor_course(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- decide_tutor_course: admin approves or rejects one request, and tells the
-- tutor either way.
-- ---------------------------------------------------------------------------

create or replace function decide_tutor_course(
  p_tutor_id uuid,
  p_course_id uuid,
  p_approve boolean
)
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
    set status = case when p_approve then 'approved' else 'rejected' end,
        decided_by = auth.uid(),
        decided_at = now()
    where tutor_id = p_tutor_id and course_id = p_course_id
    returning * into v_row;

  if not found then
    raise exception 'request_not_found';
  end if;

  select name into v_course_name from courses where id = p_course_id;

  perform notify_user(
    p_tutor_id,
    case when p_approve then 'course_approved' else 'course_rejected' end,
    case when p_approve then 'Course approved' else 'Course request declined' end,
    case when p_approve
      then format('You''re approved to tutor %s.', v_course_name)
      else format('Your request to tutor %s wasn''t approved. Ask an admin if you think this is a mistake.', v_course_name)
    end,
    '/tutor/courses',
    case when p_approve then 'You''re approved to tutor ' || v_course_name
         else 'Update on your ' || v_course_name || ' tutoring request' end,
    case when p_approve
      then format('<p>You''re now approved to tutor <strong>%s</strong>. You can post availability for it right away.</p>', v_course_name)
      else format('<p>Your request to tutor <strong>%s</strong> wasn''t approved this time. Reach out to an admin if you think this is a mistake.</p>', v_course_name)
    end
  );

  return v_row;
end;
$$;

revoke all on function decide_tutor_course(uuid, uuid, boolean) from public;
grant execute on function decide_tutor_course(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Read helpers. get_pending_tutor_courses is admin-only and joins profiles,
-- which a plain PostgREST embed can't do here: admins *can* read profiles,
-- but bundling the join in one definer function keeps the admin screen to a
-- single round trip.
-- ---------------------------------------------------------------------------

create or replace function get_pending_tutor_courses()
returns table (
  tutor_id uuid,
  tutor_name text,
  tutor_email text,
  course_id uuid,
  course_name text,
  subject_name text,
  requested_at timestamptz
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
    select tc.tutor_id, p.full_name, p.email, tc.course_id, c.name, s.name,
           tc.requested_at
    from tutor_courses tc
    join profiles p on p.id = tc.tutor_id
    join courses c on c.id = tc.course_id
    join subjects s on s.id = c.subject_id
    where tc.status = 'pending'
    order by tc.requested_at asc;
end;
$$;

revoke all on function get_pending_tutor_courses() from public;
grant execute on function get_pending_tutor_courses() to authenticated;
