begin;

-- CV uploads are registered only after the object has been stored. Keeping the
-- document, selectable CV version, and confirmed knowledge artefact in one RPC
-- prevents partially registered CVs.
create or replace function public.register_cv_upload_v1(
  p_user_id uuid,
  p_document_id uuid,
  p_cv_version_id uuid,
  p_artifact_id uuid,
  p_filename text,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_name text,
  p_intended_roles text[],
  p_notes text,
  p_is_primary boolean
)
returns table (
  document_id uuid,
  cv_version_id uuid,
  artifact_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), 'unknown');
  confirmed_time timestamptz := timezone('utc', now());
  normalized_roles text[];
  artifact_stable_id text;
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV upload registration is not authorised';
  end if;

  -- This row lock both proves the owner exists and serializes changes to the
  -- user's single-primary invariant across register/set-primary operations.
  perform 1
  from public.prototype_users as owner
  where owner.id = p_user_id
  for update;
  if not found then
    raise exception 'CV owner not found';
  end if;

  if p_document_id is null
    or p_cv_version_id is null
    or p_artifact_id is null
  then
    raise exception 'document, CV version, and artefact ids are required';
  end if;
  if nullif(btrim(p_filename), '') is null
    or p_filename ~ '[/\\]'
  then
    raise exception 'a plain, non-empty filename is required';
  end if;
  if p_storage_bucket is distinct from 'career-documents' then
    raise exception 'CV uploads must use the career-documents bucket';
  end if;
  if nullif(btrim(p_storage_path), '') is null
    or p_storage_path not like p_user_id::text || '/%'
    or p_storage_path ~ '(^|/)\.\.(/|$)'
  then
    raise exception 'CV storage path must be inside the owner folder';
  end if;
  if nullif(btrim(p_mime_type), '') is null then
    raise exception 'CV MIME type is required';
  end if;
  if p_byte_size is null or p_byte_size <= 0 then
    raise exception 'CV byte size must be positive';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'CV sha256 must be a lowercase hexadecimal digest';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'CV name is required';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_intended_roles, '{}'::text[]))
      as intended_role(value)
    where nullif(btrim(intended_role.value), '') is null
  ) then
    raise exception 'intended roles cannot contain blank values';
  end if;

  select coalesce(
    array_agg(btrim(intended_role.value) order by intended_role.ordinality),
    '{}'
  )
  into normalized_roles
  from unnest(coalesce(p_intended_roles, '{}'::text[]))
    with ordinality as intended_role(value, ordinality);

  if coalesce(p_is_primary, false) then
    update public.cv_versions
    set is_primary = false
    where user_id = p_user_id
      and is_primary;
  end if;

  insert into public.documents (
    id,
    user_id,
    kind,
    filename,
    storage_bucket,
    storage_path,
    mime_type,
    byte_size,
    sha256,
    processing_status,
    metadata
  ) values (
    p_document_id,
    p_user_id,
    'cv',
    btrim(p_filename),
    p_storage_bucket,
    p_storage_path,
    btrim(p_mime_type),
    p_byte_size,
    p_sha256,
    'pending',
    jsonb_build_object('registration_source', 'cv_library_upload')
  );

  insert into public.cv_versions (
    id,
    user_id,
    document_id,
    name,
    is_primary,
    intended_roles,
    notes
  ) values (
    p_cv_version_id,
    p_user_id,
    p_document_id,
    btrim(p_name),
    coalesce(p_is_primary, false),
    normalized_roles,
    nullif(btrim(p_notes), '')
  );

  artifact_stable_id := 'upload-' || replace(p_artifact_id::text, '-', '');

  insert into public.cv_artifacts (
    id,
    user_id,
    stable_id,
    name,
    intended_role_families,
    source_document_id,
    cv_version_id,
    revision_identifier,
    emphasis_summary,
    status,
    confidence,
    source_type,
    source_ref,
    last_confirmed_at,
    criticality,
    stale_behavior,
    tags
  ) values (
    p_artifact_id,
    p_user_id,
    artifact_stable_id,
    btrim(p_name),
    normalized_roles,
    p_document_id,
    p_cv_version_id,
    'upload',
    nullif(btrim(p_notes), ''),
    'confirmed',
    1,
    'user_input',
    jsonb_build_object(
      'document_id', p_document_id,
      'cv_version_id', p_cv_version_id,
      'filename', btrim(p_filename)
    ),
    confirmed_time,
    'normal',
    'warn',
    array['cv-library', 'user-upload']
  );

  return query
  select p_document_id, p_cv_version_id, p_artifact_id;
end;
$$;

create or replace function public.set_primary_cv_version_v1(
  p_user_id uuid,
  p_cv_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), 'unknown');
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'primary CV update is not authorised';
  end if;

  perform 1
  from public.prototype_users as owner
  where owner.id = p_user_id
  for update;
  if not found then
    raise exception 'CV owner not found';
  end if;

  perform 1
  from public.cv_versions as version
  where version.id = p_cv_version_id
    and version.user_id = p_user_id;
  if not found then
    raise exception 'owned CV version not found';
  end if;

  update public.cv_versions
  set is_primary = (id = p_cv_version_id)
  where user_id = p_user_id
    and (is_primary or id = p_cv_version_id);

  return p_cv_version_id;
end;
$$;

create or replace function public.update_cv_version_metadata_v1(
  p_user_id uuid,
  p_cv_version_id uuid,
  p_name text,
  p_intended_roles text[],
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), 'unknown');
  normalized_roles text[];
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV metadata update is not authorised';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'CV name is required';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_intended_roles, '{}'::text[]))
      as intended_role(value)
    where nullif(btrim(intended_role.value), '') is null
  ) then
    raise exception 'intended roles cannot contain blank values';
  end if;

  select coalesce(
    array_agg(btrim(intended_role.value) order by intended_role.ordinality),
    '{}'
  )
  into normalized_roles
  from unnest(coalesce(p_intended_roles, '{}'::text[]))
    with ordinality as intended_role(value, ordinality);

  perform 1
  from public.cv_versions as version
  where version.id = p_cv_version_id
    and version.user_id = p_user_id
  for update;
  if not found then
    raise exception 'owned CV version not found';
  end if;

  update public.cv_versions
  set
    name = btrim(p_name),
    intended_roles = normalized_roles,
    notes = nullif(btrim(p_notes), '')
  where id = p_cv_version_id
    and user_id = p_user_id;

  -- The artefact is the typed representation used by later analysis. Keep its
  -- user-controlled identity metadata aligned with the CV library row.
  update public.cv_artifacts
  set
    name = btrim(p_name),
    intended_role_families = normalized_roles,
    emphasis_summary = nullif(btrim(p_notes), ''),
    last_confirmed_at = timezone('utc', now())
  where cv_version_id = p_cv_version_id
    and user_id = p_user_id
    and source_type = 'user_input';

  return p_cv_version_id;
end;
$$;

revoke all on function public.register_cv_upload_v1(
  uuid, uuid, uuid, uuid, text, text, text, text, bigint, text,
  text, text[], text, boolean
) from public;
revoke all on function public.set_primary_cv_version_v1(uuid, uuid) from public;
revoke all on function public.update_cv_version_metadata_v1(
  uuid, uuid, text, text[], text
) from public;

grant execute on function public.register_cv_upload_v1(
  uuid, uuid, uuid, uuid, text, text, text, text, bigint, text,
  text, text[], text, boolean
) to service_role;
grant execute on function public.set_primary_cv_version_v1(
  uuid, uuid
) to service_role;
grant execute on function public.update_cv_version_metadata_v1(
  uuid, uuid, text, text[], text
) to service_role;

comment on function public.register_cv_upload_v1(
  uuid, uuid, uuid, uuid, text, text, text, text, bigint, text,
  text, text[], text, boolean
) is
  'Atomically registers one stored CV as a document, selectable version, and confirmed user-input artefact.';
comment on function public.set_primary_cv_version_v1(uuid, uuid) is
  'Atomically makes one owned CV version primary while clearing the previous primary.';
comment on function public.update_cv_version_metadata_v1(
  uuid, uuid, text, text[], text
) is
  'Updates owned CV library metadata and keeps its user-input artefact identity metadata aligned.';

commit;
