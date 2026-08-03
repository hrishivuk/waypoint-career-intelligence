begin;

create or replace function public.stage_career_narrative_import_v1(
  p_user_id uuid,
  p_source_text text,
  p_source_hash text,
  p_model_metadata jsonb,
  p_candidates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_import public.career_narrative_imports%rowtype;
  staged_import_id uuid := gen_random_uuid();
  expected_candidates integer;
  inserted_candidates integer;
begin
  if coalesce(auth.role(), 'unknown') <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'NARRATIVE_IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if length(btrim(p_source_text)) < 100
    or p_source_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_model_metadata) <> 'object'
    or jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) = 0
  then
    raise exception 'INVALID_NARRATIVE_STAGE' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into existing_import
  from public.career_narrative_imports
  where user_id = p_user_id
    and source_hash = p_source_hash;

  if found then
    if existing_import.status = 'staged' then
      return existing_import.id;
    end if;
    raise exception 'NARRATIVE_ALREADY_REVIEWED' using errcode = 'P0001';
  end if;

  update public.career_narrative_imports
  set status = 'superseded'
  where user_id = p_user_id
    and status = 'staged';

  insert into public.career_narrative_imports (
    id, user_id, source_text, source_hash, status, model_metadata
  ) values (
    staged_import_id,
    p_user_id,
    p_source_text,
    p_source_hash,
    'staged',
    p_model_metadata
  );

  expected_candidates := jsonb_array_length(p_candidates);
  insert into public.career_narrative_candidates (
    user_id, import_id, record_type, title, statement, structured_data,
    source_block_id, source_excerpt, confidence, decision, reconciliation,
    target_record_id, canonical_key, display_order
  )
  select
    p_user_id,
    staged_import_id,
    candidate.record_type,
    candidate.title,
    candidate.statement,
    candidate.structured_data,
    candidate.source_block_id,
    candidate.source_excerpt,
    candidate.confidence,
    'pending',
    candidate.reconciliation,
    candidate.target_record_id,
    candidate.canonical_key,
    candidate.display_order
  from jsonb_to_recordset(p_candidates) as candidate(
    record_type public.master_profile_record_type,
    title text,
    statement text,
    structured_data jsonb,
    source_block_id text,
    source_excerpt text,
    confidence numeric,
    reconciliation public.narrative_candidate_reconciliation,
    target_record_id uuid,
    canonical_key text,
    display_order integer
  );

  get diagnostics inserted_candidates = row_count;
  if inserted_candidates <> expected_candidates then
    raise exception 'INVALID_NARRATIVE_STAGE' using errcode = '22023';
  end if;

  return staged_import_id;
end;
$$;

comment on function public.stage_career_narrative_import_v1(uuid, text, text, jsonb, jsonb) is
  'Atomically supersedes the prior staged review and creates a complete authenticated caller-owned narrative import with candidates.';

revoke all on function public.stage_career_narrative_import_v1(uuid, text, text, jsonb, jsonb) from public;
grant execute on function public.stage_career_narrative_import_v1(uuid, text, text, jsonb, jsonb) to authenticated;

commit;
