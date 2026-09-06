import Link from "next/link";
import { redirect } from "next/navigation";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";

/**
 * Admin shell. Sub-navigation is plain links driven by the URL rather than
 * client state — server-rendered, shareable, bookmarkable, and it sidesteps
 * needing a Tabs primitive (there is no wrapper for one in this project).
 */
const SECTIONS = [
  { href: "/admin", label: "Overview", group: "" },
  { href: "/admin/users", label: "Manage users", group: "People" },
  { href: "/admin/tutors", label: "Tutor roster", group: "People" },
  { href: "/admin/requests", label: "Requests", group: "Tutoring" },
  { href: "/admin/sessions", label: "Sessions", group: "Tutoring" },
  { href: "/admin/hours", label: "Hours", group: "Hours" },
  { href: "/admin/hours-documents", label: "Hours documents", group: "Hours" },
  { href: "/admin/closures", label: "School closures", group: "Setup" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1 overflow-x-auto rounded-full border border-border/60 bg-card p-1 text-sm">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-full px-3 py-1 whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {section.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
