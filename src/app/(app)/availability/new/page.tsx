import { redirect } from "next/navigation";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getActiveLocations, getActiveSubjects } from "@/lib/data/slots";
import { getDefaultSlotWindow } from "@/lib/format";
import { NewSlotForm } from "./new-slot-form";

export const metadata = { title: "Post a slot" };

export default async function NewSlotPage() {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "tutor")) {
    redirect("/availability");
  }

  const supabase = await createClient();
  const [subjects, locations] = await Promise.all([
    getActiveSubjects(supabase),
    getActiveLocations(supabase),
  ]);

  const { start: defaultStart, end: defaultEnd } = getDefaultSlotWindow();

  return (
    <NewSlotForm
      subjects={subjects}
      locations={locations}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
    />
  );
}
