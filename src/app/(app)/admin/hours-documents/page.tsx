import { DownloadIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getAllHourDocuments,
  signHourDocuments,
} from "@/lib/data/hour-documents";
import { revokeHourDocumentAction } from "@/app/actions/hour-documents";
import { ActionButton } from "@/components/action-button";
import { SendDocumentForm, type TutorChoice } from "./send-document-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Hours documents" };

type RosterRow = {
  tutor_id: string;
  tutor_name: string;
  tutor_email: string;
};

const sentFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function AdminHourDocumentsPage() {
  const supabase = await createClient();

  // The roster RPC already returns exactly the people who hold the tutor
  // role, which is the same set send_hour_document will accept.
  const [{ data: roster, error }, documents] = await Promise.all([
    supabase.rpc("admin_tutor_roster"),
    getAllHourDocuments(supabase),
  ]);
  if (error) throw error;

  const tutors: TutorChoice[] = ((roster ?? []) as RosterRow[]).map((row) => ({
    id: row.tutor_id,
    name: row.tutor_name,
    email: row.tutor_email,
  }));

  const signed = await signHourDocuments(supabase, documents);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hours documents
        </h1>
        <p className="text-muted-foreground">
          Send a signed hours form or verification letter to tutors. They get
          an email and can download it from their hours page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send a document</CardTitle>
          <CardDescription>
            One upload can go to as many tutors as you like — each gets their
            own copy, so removing one never affects the others.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SendDocumentForm tutors={tutors} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Nothing sent yet.
                    </TableCell>
                  </TableRow>
                )}
                {documents.map((document) => {
                  const url = signed.get(document.objectPath);
                  return (
                    <TableRow key={document.id}>
                      <TableCell className="font-medium">
                        {document.tutorName}
                      </TableCell>
                      <TableCell>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 hover:underline"
                          >
                            <DownloadIcon className="size-3.5" />
                            {document.fileName}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            {document.fileName} (file missing)
                          </span>
                        )}
                        {document.note && (
                          <span className="block text-xs text-muted-foreground">
                            {document.note}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sentFormatter.format(new Date(document.createdAt))}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionButton
                          action={revokeHourDocumentAction}
                          fields={{ documentId: document.id }}
                          label="Remove"
                          pendingLabel="Removing..."
                          variant="outline"
                          confirmMessage={`Remove this document from ${document.tutorName}?`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
