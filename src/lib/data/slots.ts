import type { SupabaseClient } from "@supabase/supabase-js";

export type SlotStatus = "open" | "full" | "cancelled" | "completed";
export type ReservationStatus = "booked" | "cancelled" | "no_show" | "completed";

export type OpenSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  max_capacity: number;
  status: SlotStatus;
  notes: string | null;
  tutor_id: string;
  tutor_name: string;
  subject_name: string | null;
  location_name: string;
  reserved_count: number;
};

export type OwnSlot = OpenSlot;

export type MyReservation = {
  id: string;
  status: ReservationStatus;
  booked_at: string;
  slot_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  max_capacity: number;
  reserved_count: number;
  slot_status: SlotStatus;
  tutor_name: string;
  subject_name: string | null;
  location_name: string;
};

// select shared by every slot listing query, joining reference data so the
// UI never has to make a second round trip. reserved_count is a computed
// column (see migration 0003) — it's needed instead of joining reservations
// directly because a viewer can't see other people's reservation rows.
const SLOT_SELECT = `
  id, starts_at, ends_at, capacity, max_capacity, status, notes, tutor_id,
  reserved_count,
  tutor:profiles!availability_slots_tutor_id_fkey(full_name),
  subject:subjects(name),
  location:locations(name)
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSlotRow(row: any): OpenSlot {
  return {
    id: row.id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    capacity: row.capacity,
    max_capacity: row.max_capacity,
    status: row.status,
    notes: row.notes,
    tutor_id: row.tutor_id,
    tutor_name: row.tutor?.full_name ?? "Unknown tutor",
    subject_name: row.subject?.name ?? null,
    location_name: row.location?.name ?? "Unknown location",
    reserved_count: row.reserved_count ?? 0,
  };
}

/** Every open, upcoming slot — what the tutee-facing calendar shows. */
export async function getOpenSlots(
  supabase: SupabaseClient
): Promise<OpenSlot[]> {
  const { data, error } = await supabase
    .from("availability_slots")
    .select(SLOT_SELECT)
    .eq("status", "open")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapSlotRow);
}

/** A tutor's own slots, any status, most recent first. */
export async function getOwnSlots(
  supabase: SupabaseClient,
  tutorId: string
): Promise<OwnSlot[]> {
  const { data, error } = await supabase
    .from("availability_slots")
    .select(SLOT_SELECT)
    .eq("tutor_id", tutorId)
    .order("starts_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapSlotRow);
}

/** The current user's reservations (any status), most recent first. */
export async function getMyReservations(
  supabase: SupabaseClient,
  tuteeId: string
): Promise<MyReservation[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id, status, booked_at,
      slot:availability_slots(
        id, starts_at, ends_at, capacity, max_capacity, status, reserved_count,
        tutor:profiles!availability_slots_tutor_id_fkey(full_name),
        subject:subjects(name),
        location:locations(name)
      )
    `
    )
    .eq("tutee_id", tuteeId)
    .order("booked_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    status: row.status,
    booked_at: row.booked_at,
    slot_id: row.slot.id,
    starts_at: row.slot.starts_at,
    ends_at: row.slot.ends_at,
    capacity: row.slot.capacity,
    max_capacity: row.slot.max_capacity,
    reserved_count: row.slot.reserved_count ?? 0,
    slot_status: row.slot.status,
    tutor_name: row.slot.tutor?.full_name ?? "Unknown tutor",
    subject_name: row.slot.subject?.name ?? null,
    location_name: row.slot.location?.name ?? "Unknown location",
  }));
}

export type SlotAttendee = {
  reservationId: string;
  status: ReservationStatus;
  bookedAt: string;
  displayName: string;
  guestEmail: string | null;
  isGuest: boolean;
};

/** Who's actually booked into a slot — name (and email, if a guest) for
 * every reservation, any status. Only the slot's own tutor or an admin can
 * call this (enforced in get_slot_attendees itself); RLS already lets a
 * tutor SELECT their own slot's reservation rows, but not the account
 * booker's profile row to resolve a name — that's what the RPC is for. */
export async function getSlotAttendees(
  supabase: SupabaseClient,
  slotId: string
): Promise<SlotAttendee[]> {
  const { data, error } = await supabase.rpc("get_slot_attendees", {
    p_slot_id: slotId,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    reservationId: row.reservation_id,
    status: row.status,
    bookedAt: row.booked_at,
    displayName: row.display_name,
    guestEmail: row.guest_email,
    isGuest: row.is_guest,
  }));
}

export type ReferenceOption = { id: string; name: string };

export async function getActiveSubjects(
  supabase: SupabaseClient
): Promise<ReferenceOption[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getActiveLocations(
  supabase: SupabaseClient
): Promise<ReferenceOption[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
