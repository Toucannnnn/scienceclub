"use client";

import { useActionState } from "react";
import { createSlot } from "@/app/actions/slots";
import type { ReferenceOption } from "@/lib/data/slots";
import { toDatetimeLocalValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function NewSlotForm({
  subjects,
  locations,
  defaultStart,
  defaultEnd,
}: {
  subjects: ReferenceOption[];
  locations: ReferenceOption[];
  // Computed by the server-rendered parent page rather than here — reading
  // the current time is impure and not allowed during a client component's
  // render, so it comes in as a prop instead.
  defaultStart: Date;
  defaultEnd: Date;
}) {
  const [state, action, pending] = useActionState(createSlot, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post a slot</CardTitle>
        <CardDescription>
          Tutees will be able to book this until it fills up or you cancel
          it.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startsAt">Start</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(defaultStart)}
                required
              />
              {state?.errors?.startsAt && (
                <p className="text-sm text-destructive">
                  {state.errors.startsAt[0]}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endsAt">End</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(defaultEnd)}
                required
              />
              {state?.errors?.endsAt && (
                <p className="text-sm text-destructive">
                  {state.errors.endsAt[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="locationId">Location</Label>
            <Select name="locationId" required>
              <SelectTrigger id="locationId" className="w-full">
                <SelectValue placeholder="Choose a room" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state?.errors?.locationId && (
              <p className="text-sm text-destructive">
                {state.errors.locationId[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="subjectId">Subject (optional)</Label>
            <Select name="subjectId">
              <SelectTrigger id="subjectId" className="w-full">
                <SelectValue placeholder="Any subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subj) => (
                  <SelectItem key={subj.id} value={subj.id}>
                    {subj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="maxCapacity">Capacity</Label>
            <Input
              id="maxCapacity"
              name="maxCapacity"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
              required
            />
            <p className="text-xs text-muted-foreground">
              1 = one-on-one only. Higher lets multiple tutees book the same
              slot; a tutee who books can later lock it to just themselves
              if needed.
            </p>
            {state?.errors?.maxCapacity && (
              <p className="text-sm text-destructive">
                {state.errors.maxCapacity[0]}
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
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Posting..." : "Post slot"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
