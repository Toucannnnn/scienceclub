import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Layout for the public, no-account guest-booking flow (/book/*) — the
 * only route group that intentionally renders for signed-out visitors.
 * No nav links, no notification bell, no logout button, unlike
 * (app)/layout.tsx; a "Log in" link instead, for a returning tutor/admin
 * or a tutee who'd rather have a real account. */
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            Science Peer Tutoring
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Log in
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
