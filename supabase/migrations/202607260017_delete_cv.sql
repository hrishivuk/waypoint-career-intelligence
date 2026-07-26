begin;

create or replace function public.delete_cv_version_v1(
  p_user_id uuid,
  p_cv_version_id uuid
)
returns table (
  storage_bucket text,
  storage_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_document_id uuid;
  target_bucket text;
  target_path text;
  target_was_primary boolean;
  caller_role text := coalesce(auth.role(), 'unknown');
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV deletion is not authorised';
  end if;

  select
    version.document_id,
    document.storage_bucket,
    document.storage_path,
    version.is_primary
  into
    target_document_id,
    target_bucket,
    target_path,
    target_was_primary
  from public.cv_versions as version
  join public.documents as document
    on document.id = version.document_id
    and document.user_id = version.user_id
  where version.id = p_cv_version_id
    and version.user_id = p_user_id
  for update of version, document;

  if not found then
    raise exception 'owned CV version was not found';
  end if;

  update public.cv_artifacts
  set supersedes_artifact_id = null
  where user_id = p_user_id
    and supersedes_artifact_id in (
      select artifact.id
      from public.cv_artifacts as artifact
      where artifact.user_id = p_user_id
        and (
          artifact.cv_version_id = p_cv_version_id
          or artifact.source_document_id = target_document_id
        )
    );

  delete from public.decision_policy_cv_artifacts
  where user_id = p_user_id
    and cv_artifact_id in (
      select artifact.id
      from public.cv_artifacts as artifact
      where artifact.user_id = p_user_id
        and (
          artifact.cv_version_id = p_cv_version_id
          or artifact.source_document_id = target_document_id
        )
    );

  delete from public.analysis_cv_candidates
  where user_id = p_user_id
    and cv_version_id = p_cv_version_id;

  delete from public.cv_artifacts
  where user_id = p_user_id
    and (
      cv_version_id = p_cv_version_id
      or source_document_id = target_document_id
    );

  delete from public.cv_skill_records
  where user_id = p_user_id
    and cv_version_id = p_cv_version_id;

  delete from public.cv_evidence_records
  where user_id = p_user_id
    and cv_version_id = p_cv_version_id;

  delete from public.cv_versions
  where id = p_cv_version_id
    and user_id = p_user_id;

  delete from public.documents
  where id = target_document_id
    and user_id = p_user_id;

  if target_was_primary then
    update public.cv_versions
    set is_primary = true
    where id = (
      select replacement.id
      from public.cv_versions as replacement
      where replacement.user_id = p_user_id
      order by replacement.updated_at desc, replacement.created_at desc
      limit 1
    );
  end if;

  return query select target_bucket, target_path;
end;
$$;

revoke all on function public.delete_cv_version_v1(uuid, uuid) from public;
grant execute on function public.delete_cv_version_v1(uuid, uuid)
  to service_role;

comment on function public.delete_cv_version_v1(uuid, uuid) is
  'Deletes one owned CV document and its document-specific records without deleting personal knowledge.';

commit;
