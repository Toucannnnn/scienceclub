-- School closures for 2026-27, plus the public reads the calendar needs to
-- offer a per-date "request a tutor" button to signed-out visitors.

-- ---------------------------------------------------------------------------
-- The 2026-27 no-tutoring calendar.
--
-- Until now school_closures was empty, so is_school_day() only rejected
-- weekends and out-of-term dates — the calendar would have happily taken a
-- session on Christmas Day. `do nothing` on conflict so re-running is safe
-- and anything an admin already entered by hand survives.
--
-- A few of these fall on a Friday, which nobody hosts anyway; they're kept
-- so this stays a faithful copy of the school calendar rather than a
-- filtered one.
-- ---------------------------------------------------------------------------

insert into school_closures (closure_date, label) values
  ('2026-09-07', 'Labor Day'),
  ('2026-09-08', 'Staff development day'),
  ('2026-10-09', 'Student holiday'),
  ('2026-10-12', 'Student holiday'),
  ('2026-10-13', 'Staff development day'),
  ('2026-11-23', 'Thanksgiving break'),
  ('2026-11-24', 'Thanksgiving break'),
  ('2026-11-25', 'Thanksgiving break'),
  ('2026-11-26', 'Thanksgiving break'),
  ('2026-11-27', 'Thanksgiving break'),
  ('2026-12-21', 'Winter break'),
  ('2026-12-22', 'Winter break'),
  ('2026-12-23', 'Winter break'),
  ('2026-12-24', 'Winter break'),
  ('2026-12-25', 'Winter break'),
  ('2026-12-28', 'Winter break'),
  ('2026-12-29', 'Winter break'),
  ('2026-12-30', 'Winter break'),
  ('2026-12-31', 'Winter break'),
  ('2027-01-01', 'Winter break'),
  ('2027-01-04', 'Winter break'),
  ('2027-01-18', 'MLK Day'),
  ('2027-02-12', 'Student holiday'),
  ('2027-02-15', 'Presidents Day'),
  ('2027-03-15', 'Spring break'),
  ('2027-03-16', 'Spring break'),
  ('2027-03-17', 'Spring break'),
  ('2027-03-18', 'Spring break'),
  ('2027-03-19', 'Spring break'),
  ('2027-03-26', 'Bad weather make-up day'),
  ('2027-04-16', 'Bad weather make-up day'),
  ('2027-04-30', 'Student holiday')
on conflict (closure_date) do nothing;

-- ---------------------------------------------------------------------------
-- Public read for the catalog.
--
-- teachers, courses and subjects are all `for select using (is_approved())`,
-- and course_hosts_on/course_teacher_name are NOT security definer. So an
-- anonymous visitor calling them sees zero teacher rows and gets a silent
-- `false` — which would make a public "which dates can I request?" feature
-- quietly claim nobody ever hosts.
--
-- This exposes nothing new: teacher names, course names and locations are
-- already public through get_public_open_slots().
-- ---------------------------------------------------------------------------

create policy teachers_select_public on teachers
  for select using (is_active);

create policy courses_select_public on courses
  for select using (is_active);

create policy subjects_select_public on subjects
  for select using (is_active);

-- ---------------------------------------------------------------------------
-- get_calendar_days: one row per date in the range, telling the calendar
-- whether that day can take a request and who is hosting.
--
-- Nothing existing answers this. course_hosts_on() takes a *course* and
-- returns a boolean; course_teacher_name() ignores the date entirely. The
-- calendar needs the inverse: given a date, is it open and who's there.
-- ---------------------------------------------------------------------------

create or replace function get_calendar_days(p_from date, p_to date)
returns table (
  day date,
  is_open boolean,
  closure_label text,
  teacher_names text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d::date,
    -- Open means: a weekday, inside a term, not closed, AND somebody hosts.
    -- The last condition is what stops Friday appearing bookable: it's a
    -- school day, but no teacher holds a room then.
    is_school_day(d::date)
      and exists (
        select 1 from teachers t
        where t.is_active
          and extract(dow from d)::smallint = any(t.weekdays)
      ),
    (select c.label from school_closures c where c.closure_date = d::date),
    coalesce((
      select array_agg(t.name order by t.name)
      from teachers t
      where t.is_active
        and extract(dow from d)::smallint = any(t.weekdays)
    ), '{}')
  from generate_series(p_from, p_to, interval '1 day') as d
  order by d;
$$;

revoke all on function get_calendar_days(date, date) from public;
grant execute on function get_calendar_days(date, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_courses_for_date: which courses can actually be requested on a given
-- date — i.e. the ones whose teacher holds a room that weekday. Drives the
-- course picker on the request form so a tutee can't choose Chemistry on a
-- Tuesday and only find out after submitting.
-- ---------------------------------------------------------------------------

create or replace function get_courses_for_date(p_date date)
returns table (
  course_id uuid,
  course_name text,
  subject_name text,
  teacher_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, s.name, t.name
  from courses c
  join subjects s on s.id = c.subject_id
  join teachers t on t.subject_id = c.subject_id and t.is_active
  where c.is_active
    and extract(dow from p_date)::smallint = any(t.weekdays)
  order by s.name, c.sort_order;
$$;

revoke all on function get_courses_for_date(date) from public;
grant execute on function get_courses_for_date(date) to anon, authenticated;
