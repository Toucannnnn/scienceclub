"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/dal";

/** Both invoked directly from the notification bell's onClick handlers
 * (plain Server Functions, not <form> actions) — the dropdown it lives in
 * is already client-only, so there's no progressive-enhancement case to
 * design a FormData-based form around here. */

export async function markNotificationRead(notificationId: string) {
  await requireAuthUser();
  const supabase = await createClient();
  await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  await requireAuthUser();
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/", "layout");
}
