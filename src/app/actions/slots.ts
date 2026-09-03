"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { CreateSlotFormSchema, type CreateSlotFormState } from "@/lib/definitions";

/** Maps a Postgres RPC error message (raised via `raise exception`) to a
 * friendly, user-facing one. Anything unrecognized falls back to a generic
 * message rather than leaking a raw error string. */
function friendlyRpcError(message: string): string {
  const known: Record<string, string> = {
    slot_full: "That slot just filled up — someone booked it first.",
    slot_not_open: "That slot is no longer open.",
    slot_in_past: "That slot has already started.",
    slot_not_found: "That slot no longer exists.",
    cannot_book_own_slot: "You can't book your own availability slot.",
    booking_restricted: "Your account is temporarily restricted from booking.",
    not_approved: "Your account isn't approved yet.",
    not_authorized: "You're not able to do that.",
    reservation_not_found: "That reservation no longer exists.",
    reservation_not_active: "That reservation isn't active anymore.",
    capacity_out_of_range: "That capacity isn't allowed for this slot.",
    capacity_below_current_bookings:
      "Can't set capacity below the number of people already booked.",
  };
  for (const [code, friendly] of Object.entries(known)) {
    if (message.includes(code)) return friendly;
  }
  return "Something went wrong. Please try again.";
}

export async function createSlot(
  _state: CreateSlotFormState,
  formData: FormData
): Promise<CreateSlotFormState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "tutor")) {
    return { message: "Only tutors can post availability." };
  }

  const validatedFields = CreateSlotFormSchema.safeParse({
    subjectId: formData.get("subjectId") ?? "",
    locationId: formData.get("locationId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    maxCapacity: formData.get("maxCapacity"),
    notes: formData.get("notes") ?? "",
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { subjectId, locationId, startsAt, endsAt, maxCapacity, notes } =
    validatedFields.data;

  const supabase = await createClient();
  const { error } = await supabase.from("availability_slots").insert({
    tutor_id: profile.id,
    subject_id: subjectId || null,
    location_id: locationId,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    capacity: maxCapacity,
    max_capacity: maxCapacity,
    notes: notes || null,
  });

  if (error) {
    return { message: "Could not create that slot. Please try again." };
  }

  revalidatePath("/availability");
  redirect("/availability");
}

export type ActionState = { message?: string } | undefined;

export async function reserveSlotAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const slotId = formData.get("slotId") as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc("reserve_slot", { p_slot_id: slotId });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/calendar");
  revalidatePath("/my-bookings");
  return { message: "Reserved! See it under My Bookings." };
}

export async function cancelReservationAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const reservationId = formData.get("reservationId") as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: reservationId,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/calendar");
  revalidatePath("/my-bookings");
  return { message: "Reservation cancelled." };
}

export async function setSlotCapacityAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const slotId = formData.get("slotId") as string;
  const newCapacity = Number(formData.get("newCapacity"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_slot_capacity", {
    p_slot_id: slotId,
    p_new_capacity: newCapacity,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/calendar");
  revalidatePath("/my-bookings");
  revalidatePath("/availability");
  return { message: "Capacity updated." };
}

export async function cancelSlotAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const slotId = formData.get("slotId") as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_slot", { p_slot_id: slotId });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath("/availability");
  revalidatePath("/calendar");
  revalidatePath("/my-bookings");
  return { message: "Slot cancelled." };
}
