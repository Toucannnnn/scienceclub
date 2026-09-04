import Link from "next/link";
import Image from "next/image";
import {
  CalendarDaysIcon,
  MousePointerClickIcon,
  MailCheckIcon,
  GraduationCapIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicOpenSlots } from "@/lib/data/public-slots";
import { formatSlotTimeRange } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    icon: CalendarDaysIcon,
    title: "Browse the calendar",
    body: "Every open tutoring slot our tutors have posted, laid out by day and time. No login needed to look.",
  },
  {
    icon: MousePointerClickIcon,
    title: "Click a slot",
    body: "Pick a time that works. Enter your name and email — that's it, no account, no password.",
  },
  {
    icon: MailCheckIcon,
    title: "Get confirmed",
    body: "We email you a confirmation, a reminder before your session, and a private link to cancel if plans change.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const slots = await getPublicOpenSlots(supabase);
  const nextSlots = slots.slice(0, 3);

  return (
    <div className="flex flex-col gap-16 py-6">
      <section className="relative">
        <div className="spark-glow pointer-events-none absolute inset-x-0 -top-24 h-64" />
        <div className="relative flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1.5 pr-4 pl-1.5 text-sm">
            <Image
              src="/liberty-logo.svg"
              alt="Liberty High School"
              width={28}
              height={28}
              className="size-7"
            />
            <span className="text-muted-foreground">
              Liberty High School · Frisco, TX
            </span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Free science tutoring,{" "}
            <span className="text-spark">booked in seconds</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Science All Stars pairs students with peer tutors for
            one-on-one help. Find a time on the calendar and book it — you
            don&apos;t even need an account.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/calendar"
              className={buttonVariants({ size: "lg", className: "rounded-full px-6" })}
            >
              View the calendar
            </Link>
            <Link
              href="/signup"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "rounded-full px-6",
              })}
            >
              Sign up as a tutor
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {slots.length > 0
              ? `${slots.length} open slot${slots.length === 1 ? "" : "s"} right now`
              : "No open slots posted yet — check back soon."}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <Card key={step.title} className="border-border/70">
            <CardContent className="flex flex-col gap-3 p-6">
              <span className="bg-spark flex size-9 items-center justify-center rounded-xl text-white">
                <step.icon className="size-4" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Step {i + 1}
                </p>
                <h2 className="mt-0.5 font-medium">{step.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {nextSlots.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Coming up next
            </h2>
            <Link
              href="/calendar"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              See the full calendar
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {nextSlots.map((slot) => {
              const spotsLeft = slot.capacity - slot.reserved_count;
              return (
                <Link key={slot.id} href={`/book/${slot.id}`}>
                  <Card className="h-full border-border/70 transition-colors hover:bg-accent/40">
                    <CardContent className="flex flex-col gap-1 p-5">
                      <p className="font-medium">
                        {formatSlotTimeRange(slot.starts_at, slot.ends_at)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {slot.tutor_name} · {slot.location_name}
                        {slot.subject_name ? ` · ${slot.subject_name}` : ""}
                      </p>
                      {slot.max_capacity > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-border/70 bg-card p-8 sm:p-12">
        <div className="flex flex-col items-start gap-4">
          <span className="bg-spark flex size-9 items-center justify-center rounded-xl text-white">
            <GraduationCapIcon className="size-4" />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">
            Want to tutor?
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Tutors post their own availability, see who&apos;s booked in, and
            track their sessions. Sign up and an admin will approve your
            account — then your slots show up right here on the calendar.
          </p>
          <Link
            href="/signup"
            className={buttonVariants({ className: "rounded-full px-6" })}
          >
            Apply to tutor
          </Link>
        </div>
      </section>
    </div>
  );
}
