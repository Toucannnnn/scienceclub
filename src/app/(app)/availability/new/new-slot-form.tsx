"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createSlot } from "@/app/actions/slots";
import { parseSessionDate, SESSION_TIME_LABEL } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** One of the tutor's approved courses, with the weekdays its teacher hosts
 * (0 = Sunday, matching JS getDay()). */
export type PostableCourse = {
  id: string;
  name: string;
  subjectName: string;
  teacherName: string | null;
  weekdays: number[];
};

/** A date this tutor can actually post on, and which of their courses are
 * hosted that day. Computed on the server — see page.tsx. */
export type PostableDay = {
  date: string;
  courseIds: string[];
};

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

const dayOptionFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

/** Radio-style choice rendered as a segmented control, matching the
 * calendar's view switcher. No ToggleGroup wrapper exists in this project. */
function ModeChoice<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; hint: string }[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name={name} value={value} />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
              selected
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border/70 hover:bg-accent/40"
            }`}
          >
            <span className="block font-medium">{option.label}</span>
            <span className="block text-xs text-muted-foreground">
              {option.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/availability"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to Tutor availability
        </Link>
      </CardContent>
    </Card>
  );
}

export function NewSlotForm({
  days,
  courses,
  hasApprovedCourses,
  blockedDays,
}: {
  days: PostableDay[];
  courses: PostableCourse[];
  hasApprovedCourses: boolean;
  blockedDays: number;
}) {
  const [state, action, pending] = useActionState(createSlot, undefined);
  const [sessionDate, setSessionDate] = useState("");
  const [courseId, setCourseId] = useState("");
  const [helpMode, setHelpMode] = useState<"individual" | "group">("group");
  const [capacityMode, setCapacityMode] = useState<"limited" | "unlimited">(
    "limited"
  );
  const [capacity, setCapacity] = useState("3");

  if (!hasApprovedCourses) {
    return (
      <EmptyState title="No approved courses yet">
        You can only post sessions for courses you&apos;ve been approved to
        tutor. Request approval from{" "}
        <Link href="/tutor/courses" className="underline underline-offset-4">
          your courses page
        </Link>{" "}
        first.
      </EmptyState>
    );
  }

  if (days.length === 0) {
    return (
      <EmptyState title="No open days to post on">
        {blockedDays > 0
          ? `You've already posted a session on every upcoming day your courses are tutored — cancel one from Tutor availability if you want to swap it.`
          : `None of your approved courses are tutored on the days coming up. Teachers each host on set weekdays, and school holidays are closed entirely.`}
      </EmptyState>
    );
  }

  // Only the courses whose teacher hosts on the chosen day. Empty until a
  // date is picked, which is what keeps the two dropdowns honest: every
  // combination the form can produce is one create_slot will accept.
  const selectedDay = days.find((day) => day.date === sessionDate);
  const availableCourses = selectedDay
    ? courses.filter((course) => selectedDay.courseIds.includes(course.id))
    : [];

  function handleDateChange(next: string) {
    setSessionDate(next);
    // The course that was picked may not be hosted on the new date — drop it
    // rather than silently submitting a combination that gets rejected.
    const day = days.find((d) => d.date === next);
    if (courseId && !day?.courseIds.includes(courseId)) setCourseId("");
  }

  // Native optgroups keep a term's worth of dates scannable.
  const months: { label: string; days: PostableDay[] }[] = [];
  for (const day of days) {
    const label = monthFormatter.format(parseSessionDate(day.date));
    const last = months[months.length - 1];
    if (last?.label === label) last.days.push(day);
    else months.push({ label, days: [day] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post a session</CardTitle>
        <CardDescription>
          Every session runs {SESSION_TIME_LABEL}, so you only pick the day.
          Only days your courses are actually tutored are listed — holidays,
          weekends and days your teacher isn&apos;t hosting are left out.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sessionDate">Day</Label>
            <select
              id="sessionDate"
              name="sessionDate"
              required
              value={sessionDate}
              onChange={(event) => handleDateChange(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="" disabled>
                Choose a day
              </option>
              {months.map((month) => (
                <optgroup key={month.label} label={month.label}>
                  {month.days.map((day) => (
                    <option key={day.date} value={day.date}>
                      {dayOptionFormatter.format(parseSessionDate(day.date))}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {state?.errors?.sessionDate && (
              <p className="text-sm text-destructive">
                {state.errors.sessionDate[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="courseId">Course</Label>
            <select
              id="courseId"
              name="courseId"
              required
              disabled={!sessionDate}
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="" disabled>
                {sessionDate ? "Choose a course" : "Pick a day first"}
              </option>
              {availableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                  {course.teacherName ? ` — ${course.teacherName}` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {sessionDate
                ? `${availableCourses.length} of your ${courses.length} approved course${
                    courses.length === 1 ? "" : "s"
                  } ${availableCourses.length === 1 ? "is" : "are"} tutored that day.`
                : "The course list depends on the day — each teacher only hosts on certain weekdays."}
            </p>
            {state?.errors?.courseId && (
              <p className="text-sm text-destructive">
                {state.errors.courseId[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Type of help</Label>
            <ModeChoice
              name="helpMode"
              value={helpMode}
              onChange={(next) => {
                setHelpMode(next);
                // One-on-one means one seat; picking Individual shouldn't
                // leave a stale group capacity behind.
                if (next === "individual") {
                  setCapacityMode("limited");
                  setCapacity("1");
                } else if (capacity === "1") {
                  setCapacity("3");
                }
              }}
              options={[
                {
                  value: "individual",
                  label: "Individual help only",
                  hint: "One tutee at a time",
                },
                {
                  value: "group",
                  label: "Group help only",
                  hint: "Several tutees together",
                },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>How many people can join?</Label>
            <ModeChoice
              name="capacityMode"
              value={capacityMode}
              onChange={setCapacityMode}
              options={[
                {
                  value: "limited",
                  label: "Set a limit",
                  hint: "Between 1 and 100",
                },
                {
                  value: "unlimited",
                  label: "Unlimited",
                  hint: "Anyone can join",
                },
              ]}
            />
            <Input
              name="capacity"
              type="number"
              min={1}
              max={100}
              required
              // Disabled inputs submit nothing, and the RPC ignores capacity
              // for unlimited slots — but the Zod schema still wants a number,
              // so keep it enabled and just make it read-only when unlimited.
              readOnly={capacityMode === "unlimited" || helpMode === "individual"}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="max-w-32"
              aria-label="Maximum number of tutees"
            />
            {state?.errors?.capacity && (
              <p className="text-sm text-destructive">
                {state.errors.capacity[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={3} maxLength={500} />
          </div>

          {state?.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
        </CardContent>
        <CardFooter className="mt-2">
          <Button type="submit" disabled={pending || !sessionDate || !courseId}>
            {pending ? "Posting..." : "Post session"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
