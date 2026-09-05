"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { CreateSlotFormSchema, type CreateSlotFormState } from "@/lib/definitions";
import { friendlyRpcError } from "@/lib/rpc-errors";

export async function createSlot(
  _state: CreateSlotFormState,
  formData: FormData
): Promise<CreateSlotFormState> {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "tutor")) {
    return { message: "Only tutors can post availability." };
  }

  const validatedFields = CreateSlotFormSchema.safeParse({
    sessionDate: formData.get("sessionDate"),
    courseId: formData.get("courseId"),
    capacityMode: formData.get("capacityMode"),
    capacity: formData.get("capacity"),
    helpMode: formData.get("helpMode"),
    notes: formData.get("notes") ?? "",
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { sessionDate, courseId, capacityMode, capacity, helpMode, notes } =
    validatedFields.data;

  // create_slot owns every rule the client can't be trusted with: course
  // approval, the teacher's hosting weekday, school closures, term bounds,
  // and the one-slot-per-tutor-per-day constraint.
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_slot", {
    p_session_date: sessionDate,
    p_course_id: courseId,
    p_capacity_mode: capacityMode,
    p_capacity: capacity,
    p_help_mode: helpMode,
    p_notes: notes || undefined,
  });

  if (error) {
    return { message: friendlyRpcError(error.message) };
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
