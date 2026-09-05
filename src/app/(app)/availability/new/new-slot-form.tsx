"use client";

import { useActionState, useState } from "react";
import { createSlot } from "@/app/actions/slots";
import type { Course } from "@/lib/data/courses";
import { Button } from "@/components/ui/button";
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

export function NewSlotForm({
  approvedCourses,
  minDate,
}: {
  approvedCourses: Course[];
  minDate: string;
}) {
  const [state, action, pending] = useActionState(createSlot, undefined);
  const [helpMode, setHelpMode] = useState<"individual" | "group">("group");
  const [capacityMode, setCapacityMode] = useState<"limited" | "unlimited">(
    "limited"
  );
  const [capacity, setCapacity] = useState("3");

  if (approvedCourses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No approved courses yet</CardTitle>
          <CardDescription>
            You can only post sessions for courses you&apos;ve been approved to
            tutor. Request approval from your courses page first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post a session</CardTitle>
        <CardDescription>
          Every session runs 12:15–12:45 PM, so you only pick the day. You can
          only choose days the course&apos;s teacher is hosting.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sessionDate">Date</Label>
            <Input
              id="sessionDate"
              name="sessionDate"
              type="date"
              min={minDate}
              required
            />
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
              defaultValue=""
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                Choose a course
              </option>
              {approvedCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
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
          <Button type="submit" disabled={pending}>
            {pending ? "Posting..." : "Post session"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
