import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Science Peer Tutoring
        </h1>
        <p className="max-w-md text-muted-foreground">
          Tutors post availability, tutees book time slots, and admins keep
          it all running — all in one place.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/signup" className={buttonVariants()}>
          Sign up
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Log in
        </Link>
      </div>
      <Link
        href="/book"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Just need to book one session? Book as a guest — no account needed
      </Link>
    </div>
  );
}
