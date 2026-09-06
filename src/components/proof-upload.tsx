"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitHoursAction } from "@/app/actions/hours";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BUCKET = "session-proofs";
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Uploads the photo straight from the browser to Supabase Storage, then
 * submits only the resulting object path to the server.
 *
 * The bytes deliberately don't go through the Server Action: Next caps
 * action bodies at 1 MB by default and phone photos are several times that.
 * Security doesn't depend on this path — the storage policy only accepts
 * objects under the caller's own folder, and submit_session_hours re-checks
 * the prefix before trusting it.
 */
export function ProofUpload({
  slotId,
  tutorId,
  hasProof,
}: {
  slotId: string;
  tutorId: string;
  hasProof: boolean;
}) {
  const [state, action, pending] = useActionState(submitHoursAction, undefined);
  const [objectPath, setObjectPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (state?.message) toast(state.message);
  }, [state]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast("That photo is over 10 MB — try a smaller one.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // The first segment must be the tutor's id — that's what the storage
      // policy keys on.
      const path = `${tutorId}/${slotId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type });

      if (error) {
        toast(`Upload failed: ${error.message}`);
        return;
      }
      setObjectPath(path);
      setFileName(file.name);
      toast("Photo uploaded — now submit it.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="objectPath" value={objectPath} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={`proof-${slotId}`}>
          {hasProof ? "Replace the photo (optional)" : "Photo proof"}
        </Label>
        <Input
          id={`proof-${slotId}`}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          disabled={uploading || pending}
        />
        {fileName && (
          <p className="text-xs text-muted-foreground">Ready: {fileName}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`note-${slotId}`}>Note (optional)</Label>
        <Input
          id={`note-${slotId}`}
          name="note"
          maxLength={500}
          placeholder="Anything the admin should know"
        />
      </div>

      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={pending || uploading || (!objectPath && !hasProof)}
      >
        <UploadIcon />
        {pending ? "Submitting..." : uploading ? "Uploading..." : "Submit hours"}
      </Button>
      {state?.message && (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
    </form>
  );
}
