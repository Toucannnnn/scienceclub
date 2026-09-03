import Link from "next/link";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireApprovedProfile();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/calendar", label: "Calendar" },
    { href: "/my-bookings", label: "My Bookings" },
    ...(hasRole(profile, "tutor")
      ? [{ href: "/availability", label: "My Availability" }]
      : []),
    ...(hasRole(profile, "admin")
      ? [{ href: "/admin/users", label: "Manage Users" }]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              Science Peer Tutoring
            </Link>
            <div className="flex items-center gap-3">
              <div className="hidden gap-1 sm:flex">
                {profile.roles.map((role) => (
                  <Badge key={role} variant="secondary" className="capitalize">
                    {role}
                  </Badge>
                ))}
              </div>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {profile.fullName}
              </span>
              <form action={logout}>
                <Button type="submit" variant="outline" size="sm">
                  Log out
                </Button>
              </form>
            </div>
          </div>
          <nav className="flex gap-4 overflow-x-auto text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
