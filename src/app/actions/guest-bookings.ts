"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GuestBookingFormSchema, type GuestBookingFormState } from "@/lib/definitions";
import { friendlyRpcError } from "@/lib/rpc-errors";

/** Plain anon-key client is correct here (not the service-role admin
 * client) — reserve_slot_as_guest/cancel_reservation_as_guest are
 * specifically granted to `anon`; no elevated access is needed or wanted. */

export async function bookGuestSlotAction(
  _state: GuestBookingFormState,
  formData: FormData
): Promise<GuestBookingFormState> {
  const validatedFields = GuestBookingFormSchema.safeParse({
    slotId: formData.get("slotId"),
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { slotId, name, email } = validatedFields.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve_slot_as_guest", {
    p_slot_id: slotId,
    p_name: name,
    p_email: email,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  redirect(`/book/manage/${data.id}?t=${data.guest_cancel_token}`);
}

export type ActionState = { message?: string } | undefined;

export async function cancelGuestReservationAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const reservationId = formData.get("reservationId") as string;
  const token = formData.get("token") as string;

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_reservation_as_guest", {
    p_reservation_id: reservationId,
    p_token: token,
  });

  if (error) return { message: friendlyRpcError(error.message) };

  revalidatePath(`/book/manage/${reservationId}`);
  return { message: "Booking cancelled." };
}
