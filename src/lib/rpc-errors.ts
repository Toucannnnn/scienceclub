/** Maps a Postgres RPC error message (raised via `raise exception`) to a
 * friendly, user-facing one. Anything unrecognized falls back to a generic
 * message rather than leaking a raw error string.
 *
 * Lives outside any "use server" file on purpose — every export of a
 * "use server" module is treated as a Server Action by Next.js, which
 * requires them all to be async; this is a plain sync helper shared by
 * src/app/actions/slots.ts and src/app/actions/guest-bookings.ts. */
export function friendlyRpcError(message: string): string {
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
    invalid_guest_details: "Please enter a valid name and email.",
    invalid_guest_link:
      "This booking link isn't valid — check you copied the whole link from your email.",
  };
  for (const [code, friendly] of Object.entries(known)) {
    if (message.includes(code)) return friendly;
  }
  return "Something went wrong. Please try again.";
}
