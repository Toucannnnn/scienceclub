export type CalendarView = "day" | "week" | "month";

export type CalendarSlot = {
  id: string;
  /** YYYY-MM-DD. Every session is 12:15–12:45 Central, so the date is the
   * only variable — this is what the calendar positions on. */
  session_date: string;
  capacity: number;
  max_capacity: number;
  capacity_mode: "limited" | "unlimited";
  help_mode: "individual" | "group";
  reserved_count: number;
  tutor_name: string;
  subject_name: string | null;
  course_name: string | null;
  location_name: string;
  notes: string | null;
  isOwn: boolean;
};

/** A CalendarSlot with its date parsed once, up front. */
export type ParsedSlot = CalendarSlot & {
  date: Date;
};

/** An open ticket from a tutee who wants a tutor on a given day. Shown next
 * to the sessions for that day so a visitor sees both halves: what's already
 * posted, and what someone has asked for. Deliberately carries no requester
 * name — see PublicRequest in src/lib/data/requests.ts. */
export type CalendarRequest = {
  id: string;
  session_date: string;
  course_name: string;
  subject_name: string;
  teacher_name: string | null;
  /** Only 'open' and 'unclaimed' ever reach the calendar. */
  status: string;
  claimable: boolean;
};

export type ParsedRequest = CalendarRequest & {
  date: Date;
};

/** Shared so today's date reads identically everywhere it appears. */
export const TODAY_PILL =
  "flex size-7 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground";

/** What a slot is called on a chip or card, in priority order: the specific
 * course if there is one, else the broad subject, else the tutor. */
export function slotLabel(slot: CalendarSlot) {
  return slot.course_name ?? slot.subject_name ?? slot.tutor_name;
}

/** Seats remaining, or null when the session takes everyone. */
export function spotsLeft(slot: CalendarSlot) {
  if (slot.capacity_mode === "unlimited") return null;
  return slot.capacity - slot.reserved_count;
}
