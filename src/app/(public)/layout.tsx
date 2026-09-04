import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

/**
 * Public shell: the landing page, the calendar, and the booking flow. All
 * reachable signed-out — SiteHeader adapts to whoever's looking, so a
 * signed-in member browsing the calendar still gets their nav and
 * notifications here.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground">
          <p>Science All Stars Tutoring — peer tutoring, free for students.</p>
          <div className="flex gap-4">
            <Link href="/calendar" className="hover:text-foreground">
              Calendar
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Become a tutor
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
