import type { SupabaseClient } from "@supabase/supabase-js";

// Backs the public calendar and booking pages — the get_public_open_slot(s)
// RPCs (0005_guest_bookings.sql, widened in 0007) rather than a table
// select, since availability_slots' RLS requires is_approved() and there's
// no policy letting anon resolve a tutor's profile name either. Granted to
// both anon and authenticated, so this is the single slot source for
// signed-out visitors and members alike. Every row returned is implicitly
// "open", so there's no status field.

export type PublicOpenSlot = {
  id: string;
  tutor_id: string;
  /** YYYY-MM-DD. The source of truth — every session is 12:15–12:45 Central,
   * so starts_at/ends_at are derived and only needed for calendar links. */
  session_date: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  max_capacity: number;
  capacity_mode: "limited" | "unlimited";
  help_mode: "individual" | "group";
  notes: string | null;
  tutor_name: string;
  subject_name: string | null;
  course_name: string | null;
  location_name: string;
  reserved_count: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPublicSlotRow(row: any): PublicOpenSlot {
  return {
    id: row.id,
    tutor_id: row.tutor_id,
    session_date: row.session_date,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    capacity: row.capacity,
    max_capacity: row.max_capacity,
    capacity_mode: row.capacity_mode ?? "limited",
    help_mode: row.help_mode ?? "group",
    notes: row.notes,
    tutor_name: row.tutor_name ?? "Unknown tutor",
    subject_name: row.subject_name,
    course_name: row.course_name,
    location_name: row.location_name ?? "Unknown location",
    reserved_count: row.reserved_count ?? 0,
  };
}

/** Every open, upcoming slot — the guest-facing /book listing. */
export async function getPublicOpenSlots(
  supabase: SupabaseClient
): Promise<PublicOpenSlot[]> {
  const { data, error } = await supabase.rpc("get_public_open_slots");
  if (error) throw error;
  return (data ?? []).map(mapPublicSlotRow);
}

/** One open slot by id, or null if it's gone/full/cancelled/past. */
export async function getPublicOpenSlot(
  supabase: SupabaseClient,
  slotId: string
): Promise<PublicOpenSlot | null> {
  const { data, error } = await supabase.rpc("get_public_open_slot", {
    p_slot_id: slotId,
  });
  if (error) throw error;
  const row = data?.[0];
  return row ? mapPublicSlotRow(row) : null;
}
