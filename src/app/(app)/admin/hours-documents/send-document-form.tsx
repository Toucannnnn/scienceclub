"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SendIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendHourDocumentAction } from "@/app/actions/hour-documents";
import { HOUR_DOCUMENTS_BUCKET } from "@/lib/data/hour-documents";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_BYTES = 10 * 1024 * 1024;

export type TutorChoice = {
  id: string;
  name: string;
  email: string;
};

/**
 * Upload a PDF once, send it to as many tutors as you like.
 *
 * The bytes go straight to storage from here rather than through the Server
 * Action, same reason as ProofUpload: action bodies are capped at 1 MB. The
 * storage policy only lets an admin write to this bucket, and
 * send_hour_document refuses a path that isn't really there — so a tampered
 * hidden field can't fabricate a document.
 */
export function SendDocumentForm({ tutors }: { tutors: TutorChoice[] }) {
  const [state, action, pending] = useActionState(
    sendHourDocumentAction,
    undefined
  );
  const [objectPath, setObjectPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (state?.message) toast(state.message);
  }, [state]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast("Only PDFs — the bucket rejects anything else.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast("That file is over 10 MB.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${crypto.randomUUID()}.pdf`;
      const { error } = await supabase.storage
        .from(HOUR_DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: "application/pdf" });

      if (error) {
        toast(`Upload failed: ${error.message}`);
        return;
      }
      setObjectPath(path);
      setFileName(file.name);
      toast("Uploaded — now pick who gets it.");
    } finally {
      setUploading(false);
    }
  }

  if (tutors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tutors yet — grant someone the tutor role from Manage users first.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="objectPath" value={objectPath} />
      <input type="hidden" name="fileName" value={fileName} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="document">PDF</Label>
        <Input
          id="document"
          type="file"
          accept="application/pdf"
          onChange={handleFile}
          disabled={uploading || pending}
        />
        {fileName && (
          <p className="text-xs text-muted-foreground">Ready: {fileName}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input
          id="note"
          name="note"
          maxLength={500}
          placeholder="e.g. Signed hours form for the fall semester"
        />
        <p className="text-xs text-muted-foreground">
          Shown to the tutor and included in the email we send them.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Send to</Label>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-xl border border-border/70 p-2">
          {tutors.map((tutor) => (
            <label
              key={tutor.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/40"
            >
              <Checkbox name="tutorIds" value={tutor.id} />
              <span>
                {tutor.name}
                <span className="block text-xs text-muted-foreground">
                  {tutor.email}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <Button
        type="submit"
        className="self-start"
        disabled={pending || uploading || !objectPath}
      >
        <SendIcon />
        {pending ? "Sending..." : uploading ? "Uploading..." : "Send document"}
      </Button>
    </form>
  );
}
