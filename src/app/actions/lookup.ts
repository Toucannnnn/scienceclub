"use server";

import { createClient } from "@/lib/supabase/server";

export type LookupState =
  | {
      message?: string;
      emailed?: boolean;
      bookings?: {
        session_date: string;
        status: string;
        course_name: string | null;
        tutor_name: string;
        location_name: string | null;
      }[];
      searched?: boolean;
    }
  | undefined;

/**
 * Instant lookup. Deliberately read-only: school addresses are guessable,
 * so anyone can see *that* a booking exists — but the cancel token is never
 * returned here. Cancelling requires the emailed link, i.e. control of the
 * inbox.
 */
export async function lookupBookingsAction(
  _state: LookupState,
  formData: FormData
): Promise<LookupState> {
  const email = ((formData.get("email") as string) || "").trim();
  if (!email || !email.includes("@")) {
    return { message: "Enter the email you booked with." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_bookings_by_email", {
    p_email: email,
  });

  if (error) return { message: "Something went wrong. Try again." };

  return { bookings: data ?? [], searched: true };
}

/**
 * Emails a one-time link that returns the same bookings *plus* the ability
 * to cancel. Always reports the same thing whether or not the address has
 * bookings — otherwise this becomes an address-enumeration oracle.
 */
export async function emailLookupLinkAction(
  _state: LookupState,
  formData: FormData
): Promise<LookupState> {
  const email = ((formData.get("email") as string) || "").trim();
  if (!email || !email.includes("@")) {
    return { message: "Enter the email you booked with." };
  }

  const supabase = await createClient();
  await supabase.rpc("send_booking_lookup_link", { p_email: email });

  return {
    emailed: true,
    message:
      "If that email has any bookings, we've sent a link to manage them. Check your inbox.",
  };
}
