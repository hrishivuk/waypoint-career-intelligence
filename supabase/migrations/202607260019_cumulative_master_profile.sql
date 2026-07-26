begin;

create type public.narrative_candidate_reconciliation as enum (
  'new',
  'update_existing',
  'already_known',
  'possible_conflict'
);

alter table public.career_narrative_candidates
  add column reconciliation public.narrative_candidate_reconciliation
    not null default 'new',
  add column target_record_id uuid,
  add column canonical_key text
    check (
      canonical_key is null
      or canonical_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  add constraint narrative_candidate_target_record_fk
    foreign key (target_record_id, user_id)
    references public.master_profile_records(id, user_id) on delete restrict;

create index narrative_candidates_target_idx
  on public.career_narrative_candidates (user_id, target_record_id);

create or replace function public.activate_career_narrative_import_v2(
  p_user_id uuid,
  p_import_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  activated_count integer := 0;
  changed_count integer;
  caller_role text := coalesce(auth.role(), 'unknown');
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'narrative activation is not authorised';
  end if;

  if not exists (
    select 1 from public.career_narrative_imports
    where id = p_import_id and user_id = p_user_id and status = 'staged'
  ) then
    raise exception 'staged narrative import was not found';
  end if;

  update public.master_profile_records as profile
  set
    title = candidate.title,
    statement = candidate.statement,
    structured_data = candidate.structured_data,
    source_import_id = candidate.import_id,
    source_candidate_id = candidate.id,
    confidence = candidate.confidence,
    status = 'confirmed'
  from public.career_narrative_candidates as candidate
  where candidate.import_id = p_import_id
    and candidate.user_id = p_user_id
    and candidate.decision = 'confirmed'
    and candidate.reconciliation in ('update_existing', 'possible_conflict')
    and candidate.target_record_id = profile.id
    and profile.user_id = p_user_id;

  get diagnostics changed_count = row_count;
  activated_count := activated_count + changed_count;

  insert into public.master_profile_records (
    user_id, record_type, canonical_key, title, statement, structured_data,
    source_import_id, source_candidate_id, confidence, status
  )
  select
    candidate.user_id,
    candidate.record_type,
    candidate.canonical_key,
    candidate.title,
    candidate.statement,
    candidate.structured_data,
    candidate.import_id,
    candidate.id,
    candidate.confidence,
    'confirmed'
  from public.career_narrative_candidates as candidate
  where candidate.import_id = p_import_id
    and candidate.user_id = p_user_id
    and candidate.decision = 'confirmed'
    and candidate.reconciliation = 'new'
    and candidate.canonical_key is not null
  on conflict (user_id, record_type, canonical_key) do nothing;

  get diagnostics changed_count = row_count;
  activated_count := activated_count + changed_count;

  update public.career_narrative_imports
  set status = 'activated', activated_at = timezone('utc', now())
  where id = p_import_id and user_id = p_user_id;

  return activated_count;
end;
$$;

revoke all on function public.activate_career_narrative_import_v2(uuid, uuid)
  from public;
grant execute on function public.activate_career_narrative_import_v2(uuid, uuid)
  to service_role;

commit;
