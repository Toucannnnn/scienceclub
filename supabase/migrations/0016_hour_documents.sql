-- Volunteer-hours paperwork: an admin uploads a signed PDF (a service-hours
-- form, a verification letter) and sends it to one or more tutors.
--
-- 0012 tracks hours as numbers; this is the piece of paper a tutor actually
-- hands to a scholarship or NHS coordinator. Nothing existing carries a file
-- from an admin *to* a tutor — session-proofs runs the other direction and
-- is images-only.

create table hour_documents (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references profiles(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  -- The object in the hour-documents bucket. Several rows may point at the
  -- same object: one upload sent to twelve tutors is one file and twelve
  -- rows, so revoking one tutor's copy never touches anyone else's.
  object_path text not null,
  file_name text not null,
  note text,
  created_at timestamptz not null default now(),

  constraint hour_documents_note_len
    check (note is null or char_length(note) <= 500),
  constraint hour_documents_file_name_len
    check (char_length(file_name) between 1 and 255),
  -- Sending the same file to the same tutor twice is a double-click, not an
  -- intent; the RPC relies on this to stay idempotent.
  unique (tutor_id, object_path)
);

create index hour_documents_tutor_idx on hour_documents(tutor_id, created_at desc);

alter table hour_documents enable row level security;

create policy hour_documents_select_own on hour_documents
  for select using (tutor_id = auth.uid());
create policy hour_documents_select_admin on hour_documents
  for select using (has_role('admin'));

-- Writes go through send_hour_document only, same as every other table here.
revoke insert, update, delete on hour_documents from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Private bucket, PDFs only.
--
-- Deliberately NOT reusing session-proofs: that one allows image MIME types
-- and its policies key on the first path segment being the *uploader's* uuid.
-- Here the uploader is an admin and the readers are tutors, so ownership by
-- path can't express the rule — read access is granted by the existence of a
-- hour_documents row instead. That's what lets one upload serve many tutors.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hour-documents', 'hour-documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- public.has_role and public.hour_documents are schema-qualified on purpose:
-- storage policies do not run with `public` in search_path, so an unqualified
-- reference fails at evaluation time rather than at create time.

create policy hour_docs_insert_admin on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hour-documents'
    and public.has_role('admin')
  );

create policy hour_docs_select_recipient on storage.objects for select to authenticated
  using (
    bucket_id = 'hour-documents'
    and (
      public.has_role('admin')
      or exists (
        select 1 from public.hour_documents d
        where d.object_path = storage.objects.name
          and d.tutor_id = auth.uid()
      )
    )
  );

create policy hour_docs_delete_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'hour-documents'
    and public.has_role('admin')
  );

-- ---------------------------------------------------------------------------
-- send_hour_document: hand an uploaded PDF to a set of tutors.
-- ---------------------------------------------------------------------------

create or replace function send_hour_document(
  p_tutor_ids uuid[], p_object_path text, p_file_name text,
  p_note text default null
)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_tutor uuid;
  v_count int := 0;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not has_role('admin') then raise exception 'not_authorized'; end if;
  if coalesce(array_length(p_tutor_ids, 1), 0) = 0 then
    raise exception 'no_recipients';
  end if;
  if nullif(trim(coalesce(p_file_name, '')), '') is null
     or nullif(trim(coalesce(p_object_path, '')), '') is null then
    raise exception 'invalid_document';
  end if;

  -- The object has to already be in the bucket. Without this an admin could
  -- create rows pointing at an arbitrary path — harmless on its own, but it
  -- would show tutors a download that 404s.
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'hour-documents' and name = p_object_path
  ) then
    raise exception 'document_not_uploaded';
  end if;

  -- distinct: sending twice to the same person in one call is a UI slip.
  for v_tutor in select distinct unnest(p_tutor_ids) loop
    if not exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = v_tutor and r.name = 'tutor'
    ) then
      raise exception 'not_a_tutor';
    end if;

    insert into hour_documents (tutor_id, uploaded_by, object_path, file_name, note)
      values (v_tutor, auth.uid(), p_object_path, trim(p_file_name), v_note)
      on conflict (tutor_id, object_path) do nothing;

    if found then
      v_count := v_count + 1;
      perform notify_user(
        v_tutor, 'hour_document', 'An admin sent you a document',
        coalesce(v_note, trim(p_file_name)), '/hours',
        'Your volunteer hours paperwork',
        format('<p>An admin sent you <strong>%s</strong>.</p>%s<p>Open your hours page to download it.</p>',
          trim(p_file_name),
          case when v_note is null then ''
               else format('<p>%s</p>', v_note) end)
      );
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function send_hour_document(uuid[], text, text, text) from public, anon;
grant execute on function send_hour_document(uuid[], text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_hour_document: take one tutor's copy back. Only ever deletes the
-- row — the object stays, because other tutors may still be pointing at it.
-- ---------------------------------------------------------------------------

create or replace function revoke_hour_document(p_document_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not has_role('admin') then raise exception 'not_authorized'; end if;
  delete from hour_documents where id = p_document_id;
  if not found then raise exception 'document_not_found'; end if;
end;
$$;

revoke all on function revoke_hour_document(uuid) from public, anon;
grant execute on function revoke_hour_document(uuid) to authenticated;
