import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { getProfileWithRoles, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/data/notifications";
import { logout } from "@/app/actions/auth";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * One header for the whole site. The calendar and landing page are public
 * but members see them too, so the header has to work signed-out (log in /
 * sign up) and signed-in (nav, notifications, log out) rather than each
 * layout shipping its own.
 */
export async function SiteHeader() {
  const profile = await getProfileWithRoles();
  const isApproved = profile?.status === "approved";

  const navLinks = [
    // Home and Calendar are the two pages anyone can reach without an
    // account, so they lead for everyone; the rest appear once approved.
    { href: "/", label: "Home" },
    { href: "/calendar", label: "Calendar" },
    ...(isApproved
      ? [
          { href: "/dashboard", label: "General dashboard" },
          { href: "/my-bookings", label: "Tutee bookings" },
        ]
      : []),
    ...(isApproved && hasRole(profile, "tutor")
      ? [
          { href: "/availability", label: "Tutor availability" },
          { href: "/requests", label: "Requests" },
        ]
      : []),
    ...(isApproved && hasRole(profile, "admin")
      ? [{ href: "/admin/users", label: "Administration" }]
      : []),
  ];

  let notifications = null;
  let unreadCount = 0;
  if (isApproved) {
    const supabase = await createClient();
    [notifications, unreadCount] = await Promise.all([
      getRecentNotifications(supabase, profile.id),
      getUnreadNotificationCount(supabase, profile.id),
    ]);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-spark flex size-8 items-center justify-center rounded-xl text-white">
              <SparklesIcon className="size-4" />
            </span>
            <span className="font-semibold tracking-tight">
              Science All Stars
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isApproved && notifications ? (
              <>
                <div className="hidden gap-1 lg:flex">
                  {profile.roles.map((role) => (
                    <Badge key={role} variant="secondary" className="capitalize">
                      {role}
                    </Badge>
                  ))}
                </div>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {profile.fullName}
                </span>
                <NotificationBell
                  initialNotifications={notifications}
                  initialUnreadCount={unreadCount}
                />
                <form action={logout}>
                  <Button type="submit" variant="outline" size="sm">
                    Log out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className={buttonVariants({ size: "sm" })}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1 whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
