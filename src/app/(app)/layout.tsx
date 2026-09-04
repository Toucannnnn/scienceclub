import { requireApprovedProfile } from "@/lib/auth/dal";
import { SiteHeader } from "@/components/site-header";

/**
 * Members-only shell: dashboard, my bookings, availability, admin. The
 * calendar and booking pages deliberately live outside this group (in
 * `(public)`) so signed-out visitors can reach them — this gate is what
 * keeps everything else account-only.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireApprovedProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
