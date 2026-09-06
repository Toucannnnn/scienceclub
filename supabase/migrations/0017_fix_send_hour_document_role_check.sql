-- Fixes the tutor check in send_hour_document, which shipped in 0016 against
-- columns that don't exist: user_roles.role_id and roles.name. The real
-- schema (0001) is user_roles.role_code -> roles.code. PL/pgSQL only plans a
-- statement the first time it runs, so `create function` accepted this
-- happily and it would have failed on the first real send.

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
      where ur.user_id = v_tutor and ur.role_code = 'tutor'
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
