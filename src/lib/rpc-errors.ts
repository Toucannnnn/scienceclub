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
    course_not_approved:
      "You're not approved to tutor that course yet — request approval first.",
    not_a_tutor: "Only tutors can do that.",
    date_in_past: "That date has already passed.",
    not_a_school_day:
      "There's no school that day, so tutoring isn't running.",
    teacher_not_hosting:
      "That course's teacher doesn't host tutoring on that day.",
    already_posted_that_day:
      "You've already posted a session for that day — cancel it first if you want to change it.",
    unlimited_slot_not_lockable:
      "This session is open to unlimited tutees, so it can't be locked.",
    invalid_capacity: "Enter a number between 1 and 100.",
    invalid_capacity_mode: "Choose a valid capacity option.",
    invalid_help_mode: "Choose individual or group help.",
    past_request_cutoff:
      "Requests have to be in before 12:00 PM on the day of tutoring, so tutors get a heads-up.",
    already_requested_that_day: "You already have a request for that day.",
    request_not_found: "That request no longer exists.",
    request_not_claimable: "That request can't be claimed right now.",
    cannot_claim_own_request: "You can't claim your own request.",
    too_late_to_claim: "That request is too old to claim now.",
    too_late_to_cancel:
      "Tutors can only back out up to the day before — talk to an admin.",
    invalid_guest_details: "Please enter a valid name and email.",
    invalid_guest_link:
      "This booking link isn't valid — check you copied the whole link from your email.",
  };
  for (const [code, friendly] of Object.entries(known)) {
    if (message.includes(code)) return friendly;
  }
  return "Something went wrong. Please try again.";
}
