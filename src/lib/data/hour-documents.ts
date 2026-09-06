import type { SupabaseClient } from "@supabase/supabase-js";

export const HOUR_DOCUMENTS_BUCKET = "hour-documents";

/** How long a download link stays good. Long enough to click, short enough
 * that a link pasted into a group chat stops working. */
const SIGNED_URL_TTL_SECONDS = 600;

export type HourDocument = {
  id: string;
  fileName: string;
  objectPath: string;
  note: string | null;
  createdAt: string;
  /** Only set on the admin listing. */
  tutorName?: string;
};

/** Documents an admin has sent to the current tutor. RLS
 * (hour_documents_select_own) does the filtering. */
export async function getMyHourDocuments(
  supabase: SupabaseClient
): Promise<HourDocument[]> {
  const { data, error } = await supabase
    .from("hour_documents")
    .select("id, file_name, object_path, note, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    fileName: row.file_name,
    objectPath: row.object_path,
    note: row.note,
    createdAt: row.created_at,
  }));
}

/** Everything sent, for the admin screen — one row per recipient, so the
 * same file appears once per tutor it went to. */
export async function getAllHourDocuments(
  supabase: SupabaseClient
): Promise<HourDocument[]> {
  const { data, error } = await supabase
    .from("hour_documents")
    .select(
      `id, file_name, object_path, note, created_at,
       tutor:profiles!hour_documents_tutor_id_fkey(full_name)`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    fileName: row.file_name,
    objectPath: row.object_path,
    note: row.note,
    createdAt: row.created_at,
    tutorName: row.tutor?.full_name ?? "Unknown tutor",
  }));
}

/**
 * Signs each document for download.
 *
 * Signing is per-object rather than per-row, so one file sent to twelve
 * tutors is signed once. A failure signs as null rather than throwing — one
 * missing object shouldn't take down the whole page.
 */
export async function signHourDocuments(
  supabase: SupabaseClient,
  documents: HourDocument[]
): Promise<Map<string, string | null>> {
  const paths = [...new Set(documents.map((d) => d.objectPath))];
  const signed = new Map<string, string | null>();

  await Promise.all(
    paths.map(async (path) => {
      const { data } = await supabase.storage
        .from(HOUR_DOCUMENTS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      signed.set(path, data?.signedUrl ?? null);
    })
  );

  return signed;
}
