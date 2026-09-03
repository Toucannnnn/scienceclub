-- Phase 1: availability slots ("tickets") and reservations — the core
-- booking loop. All state-changing operations that need to be race-safe or
-- cross-cutting (reserving, cancelling, adjusting capacity, cancelling a
-- whole slot) go through SECURITY DEFINER RPCs rather than direct table
-- writes from the client; RLS only grants direct SELECT plus the tutor's
-- own INSERT (creating a slot). This is what makes "two tutees grab the
-- last spot at once" and "a tutee locks a slot to just themselves" safe.

-- ---------------------------------------------------------------------------
-- Stubbed for Phase 4 (no-show / cancellation policy) so reserve_slot's
-- shape doesn't need to change later — always false until that migration
-- replaces this definition with a real booking_restrictions check.
-- ---------------------------------------------------------------------------

create or replace function has_active_restriction(p_user uuid)
returns boolean
language sql
stable
as $$
  select false;
$$;

-- ---------------------------------------------------------------------------
-- availability_slots
-- ---------------------------------------------------------------------------

create table availability_slots (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references profiles(id) on delete cascade,
  subject_id uuid references subjects(id),
  location_id uuid not null references locations(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- current effective capacity; max_capacity is the ceiling the tutor set
  -- at creation. A tutee holding a reservation can lower capacity (lock the
  -- slot to the current group) or raise it back up to max_capacity (reopen
  -- it) via set_slot_capacity() below.
  capacity int not null default 1 check (capacity >= 1),
  max_capacity int not null default 1 check (max_capacity >= 1),
  status text not null default 'open'
    check (status in ('open', 'full', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slot_time_valid check (ends_at > starts_at),
  constraint capacity_within_max check (capacity <= max_capacity)
);

create index availability_slots_tutor_starts_idx
  on availability_slots(tutor_id, starts_at);
create index availability_slots_open_starts_idx
  on availability_slots(starts_at) where status = 'open';
create index availability_slots_subject_idx on availability_slots(subject_id);

create trigger availability_slots_set_updated_at
  before update on availability_slots
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------

create table reservations (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references availability_slots(id) on delete cascade,
  tutee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'booked'
    check (status in ('booked', 'cancelled', 'no_show', 'completed')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  cancellation_reason text
);

create index reservations_tutee_status_idx on reservations(tutee_id, status);
create index reservations_slot_status_idx on reservations(slot_id, status);

-- A tutee can only have one *active* reservation per slot, but can rebook
-- after cancelling (a plain unique constraint would block that).
create unique index uq_reservation_active_per_tutee
  on reservations(slot_id, tutee_id)
  where status = 'booked';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table availability_slots enable row level security;
alter table reservations enable row level security;

create policy availability_slots_select_approved on availability_slots
  for select using (is_approved());

create policy availability_slots_insert_own_tutor on availability_slots
  for insert with check (has_role('tutor') and tutor_id = auth.uid());

create policy availability_slots_update_own_or_admin on availability_slots
  for update using (
    (has_role('tutor') and tutor_id = auth.uid()) or has_role('admin')
  );

create policy reservations_select_own_or_tutor_or_admin on reservations
  for select using (
    tutee_id = auth.uid()
    or has_role('admin')
    or exists (
      select 1 from availability_slots s
      where s.id = slot_id and s.tutor_id = auth.uid()
    )
  );

-- No insert/update/delete policy on reservations for authenticated users —
-- every mutation goes through the RPCs below, which run as the table owner
-- (security definer) and so aren't subject to these restrictive policies.
-- Explicit revokes are defense-in-depth on top of that RLS default-deny.
revoke insert, update, delete on reservations from authenticated, anon;

-- ---------------------------------------------------------------------------
-- reserve_slot: race-safe booking. Locks the slot row before counting
-- active reservations against capacity, so two concurrent callers can't
-- both succeed past capacity — the second blocks on the lock, then re-reads
-- the now-current count once the first commits.
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

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_reservation: a tutee cancelling their own booking (or an admin
-- cancelling on someone's behalf). Reopens the slot if it had filled up.
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

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_slot_capacity: the tutee-driven "reserve for just me" / "reopen to
-- others" action, plus tutor/admin adjustment. Bounded by max_capacity
-- (can't exceed the tutor's original ceiling) and current booked count
-- (can't shrink below people already in).
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
-- cancel_slot: tutor (or admin) cancels the whole slot. Cascades to cancel
-- every active reservation on it — tutees are not struck for this, since
-- it's the tutor's cancellation, not theirs (see cancellation_reason).
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
begin
  select * into v_slot from availability_slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot_not_found';
  end if;
  if v_slot.tutor_id <> v_caller and not has_role('admin') then
    raise exception 'not_authorized';
  end if;

  update reservations
    set status = 'cancelled', cancelled_at = now(), cancelled_by = v_caller,
        cancellation_reason = 'tutor_cancelled_slot'
    where slot_id = p_slot_id and status = 'booked';

  update availability_slots set status = 'cancelled' where id = p_slot_id
    returning * into v_slot;

  return v_slot;
end;
$$;

revoke all on function reserve_slot(uuid) from public;
grant execute on function reserve_slot(uuid) to authenticated;

revoke all on function cancel_reservation(uuid) from public;
grant execute on function cancel_reservation(uuid) to authenticated;

revoke all on function set_slot_capacity(uuid, int) from public;
grant execute on function set_slot_capacity(uuid, int) to authenticated;

revoke all on function cancel_slot(uuid) from public;
grant execute on function cancel_slot(uuid) to authenticated;
