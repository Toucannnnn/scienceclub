import type { SupabaseClient } from "@supabase/supabase-js";

// Anon-facing counterpart to src/lib/data/slots.ts's getOpenSlots — backed
// by the get_public_open_slot(s) RPCs (0005_guest_bookings.sql) rather
// than a table select, since availability_slots' RLS requires is_approved()
// and there's no policy letting anon resolve a tutor's profile name either.
// Deliberately a narrower shape than OpenSlot: no tutor_id/status, a guest
// doesn't need to know a slot's own id relative to anything, and every row
// returned is implicitly "open".

export type PublicOpenSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  max_capacity: number;
  notes: string | null;
  tutor_name: string;
  subject_name: string | null;
  location_name: string;
  reserved_count: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPublicSlotRow(row: any): PublicOpenSlot {
  return {
    id: row.id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    capacity: row.capacity,
    max_capacity: row.max_capacity,
    notes: row.notes,
    tutor_name: row.tutor_name ?? "Unknown tutor",
    subject_name: row.subject_name,
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
