import { createClient } from "@/lib/supabase/server";
import { formatSessionDate } from "@/lib/format";
import { ActionButton } from "@/components/action-button";
import { deleteClosureAction } from "@/app/actions/closures";
import { ClosureForm } from "./closure-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "School closures" };

export default async function AdminClosuresPage() {
  const supabase = await createClient();

  const [{ data: closures }, { data: terms }] = await Promise.all([
    supabase
      .from("school_closures")
      .select("closure_date, label")
      .order("closure_date"),
    supabase.from("school_terms").select("name, starts_on, ends_on").order("starts_on"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          School closures
        </h1>
        <p className="text-muted-foreground">
          Days with no school. Nobody can post a session or request a tutor on
          these dates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a closure</CardTitle>
          <CardDescription>
            Copy these from the Frisco ISD calendar — holidays, breaks, staff
            days. Until a date is listed here the calendar will happily accept
            sessions on it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClosureForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Closed days ({closures?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(closures?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing listed yet.
            </p>
          )}
          {closures?.map((closure) => (
            <div
              key={closure.closure_date}
              className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="font-medium">
                  {formatSessionDate(closure.closure_date)}
                </p>
                <p className="text-sm text-muted-foreground">{closure.label}</p>
              </div>
              <ActionButton
                action={deleteClosureAction}
                fields={{ closureDate: closure.closure_date }}
                label="Remove"
                pendingLabel="Removing..."
                variant="outline"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School year</CardTitle>
          <CardDescription>
            Sessions can only be posted inside these dates. Edit in the
            Supabase table editor if the year changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {terms?.map((term) => (
            <p key={term.name} className="text-sm">
              <span className="font-medium">{term.name}</span>
              <span className="text-muted-foreground">
                {" "}
                · {formatSessionDate(term.starts_on)} –{" "}
                {formatSessionDate(term.ends_on)}
              </span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
