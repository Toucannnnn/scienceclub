export type CalendarView = "day" | "week" | "month";

export type CalendarSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  max_capacity: number;
  reserved_count: number;
  tutor_name: string;
  subject_name: string | null;
  location_name: string;
  notes: string | null;
  isOwn: boolean;
};

/** A CalendarSlot with its ISO strings parsed once, up front. */
export type ParsedSlot = CalendarSlot & {
  start: Date;
  end: Date;
};

/** Shared so today's date reads identically in the week header, the day
 * header, and month cells. */
export const TODAY_PILL =
  "flex size-7 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground";
