import Link from "next/link";
import Image from "next/image";

/**
 * One footer for the whole site — used by both the public shell and the
 * members-only shell, so the school branding shows everywhere rather than
 * only on signed-out pages.
 *
 * The logo is a placeholder at public/liberty-logo.svg; replacing that file
 * is the entire swap. Next skips optimization automatically for a `.svg`
 * src, so no next.config images setting is needed.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Image
            src="/liberty-logo.svg"
            alt="Liberty High School"
            width={36}
            height={36}
            className="size-9"
          />
          <div className="text-sm">
            <p className="font-medium">Liberty High School</p>
            <p className="text-muted-foreground">Frisco, Texas</p>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:items-end">
          <p>Science All Stars — peer tutoring, free for students.</p>
          <div className="flex gap-4">
            <Link href="/calendar" className="hover:text-foreground">
              Calendar
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Become a tutor
            </Link>
          </div>
          <p className="text-xs">
            Got an idea to make this better?{" "}
            <a
              href="mailto:yihan.tang.903@k12.friscoisd.org"
              className="underline underline-offset-2 hover:text-foreground"
            >
              yihan.tang.903@k12.friscoisd.org
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
