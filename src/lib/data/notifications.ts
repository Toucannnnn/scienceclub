import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "booking_confirmed"
  | "new_booking"
  | "booking_cancelled"
  | "slot_cancelled"
  | "account_approved"
  | "session_reminder";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const NOTIFICATION_SELECT = "id, type, title, body, link, read_at, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNotificationRow(row: any): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Most recent notifications for the current user, newest first. */
export async function getRecentNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 15
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapNotificationRow);
}

/** How many of the current user's notifications are unread. */
export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}
