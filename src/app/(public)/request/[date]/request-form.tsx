"use client";

import { useActionState } from "react";
import {
  createGuestRequestAction,
  createRequestAction,
} from "@/app/actions/requests";
import type { CourseOption } from "@/lib/data/calendar-days";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** The course picker and note, shared by both variants. Only courses whose
 * teacher hosts this date are listed, so the picker can't offer a combination
 * assert_request_allowed() would reject. */
function SharedFields({
  courses,
  error,
}: {
  courses: CourseOption[];
  error?: string;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="courseId">What do you need help with?</Label>
        <select
          id="courseId"
          name="courseId"
          required
          defaultValue=""
          className={SELECT_CLASS}
        >
          <option value="" disabled>
            Choose a course
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} — {course.teacherName}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="note">Anything the tutor should know? (optional)</Label>
        <Textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          placeholder="e.g. stoichiometry — I have a test Friday"
        />
      </div>
    </>
  );
}

/** No account, no sign-up: a name and an email is the whole thing. */
export function GuestRequestForm({
  sessionDate,
  courses,
}: {
  sessionDate: string;
  courses: CourseOption[];
}) {
  const [state, action, pending] = useActionState(
    createGuestRequestAction,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="sessionDate" value={sessionDate} />

      <SharedFields courses={courses} error={state?.errors?.courseId?.[0]} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required />
        {state?.errors?.name && (
          <p className="text-sm text-destructive">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Your email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state?.errors?.email && (
          <p className="text-sm text-destructive">{state.errors.email[0]}</p>
        )}
        <p className="text-xs text-muted-foreground">
          We&apos;ll email you the moment a tutor claims it, plus a link to
          cancel if your plans change.
        </p>
      </div>

      {state?.message && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Ask for a tutor"}
      </Button>
    </form>
  );
}

/** Signed-in members skip the name and email — the request is tied to their
 * account and shows up under Tutee bookings. */
export function MemberRequestForm({
  sessionDate,
  courses,
}: {
  sessionDate: string;
  courses: CourseOption[];
}) {
  const [state, action, pending] = useActionState(createRequestAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="sessionDate" value={sessionDate} />

      <SharedFields courses={courses} />

      {state?.message && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Ask for a tutor"}
      </Button>
    </form>
  );
}
