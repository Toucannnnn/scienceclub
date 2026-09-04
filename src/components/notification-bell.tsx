"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/format";
import type { AppNotification } from "@/lib/data/notifications";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/actions/notifications";

export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: AppNotification[];
  initialUnreadCount: number;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();

  function handleOpenNotification(notification: AppNotification) {
    if (notification.readAt) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
      )
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    startTransition(() => {
      markNotificationRead(notification.id);
    });
  }

  function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <span className="relative inline-flex">
              <BellIcon />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-4 min-w-4 justify-center px-1 text-[0.65rem]"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <div className="flex max-h-96 flex-col gap-0.5 overflow-y-auto">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.link ?? "#"}
                onClick={() => handleOpenNotification(notification)}
                className="flex flex-col gap-0.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium">{notification.title}</span>
                  {!notification.readAt && (
                    <span
                      aria-hidden
                      className="mt-1 size-1.5 shrink-0 rounded-full bg-primary"
                    />
                  )}
                </span>
                <span className="text-muted-foreground">{notification.body}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
