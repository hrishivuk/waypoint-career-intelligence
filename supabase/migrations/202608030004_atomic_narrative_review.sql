begin;

create or replace function public.review_and_activate_career_narrative_import_v1(
  p_import_id uuid,
  p_decisions jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_import public.career_narrative_imports%rowtype;
  candidate_count integer;
  decision_count integer;
  unique_decision_count integer;
begin
  if jsonb_typeof(p_decisions) <> 'array' then
    raise exception 'INVALID_NARRATIVE_DECISIONS' using errcode = '22023';
  end if;

  select *
  into owned_import
  from public.career_narrative_imports
  where id = p_import_id
    and status = 'staged'
  for update;

  if not found then
    raise exception 'NARRATIVE_IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if coalesce(auth.role(), 'unknown') <> 'service_role'
    and not public.owns_prototype_user(owned_import.user_id)
  then
    raise exception 'NARRATIVE_IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*)
  into candidate_count
  from public.career_narrative_candidates
  where import_id = owned_import.id
    and user_id = owned_import.user_id;

  select count(*), count(distinct decision.id)
  into decision_count, unique_decision_count
  from jsonb_to_recordset(p_decisions) as decision(
    id uuid,
    decision public.narrative_candidate_decision
  );

  if candidate_count = 0
    or decision_count <> candidate_count
    or unique_decision_count <> decision_count
  then
    raise exception 'NARRATIVE_DECISION_SET_MISMATCH' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_decisions) as decision(
      id uuid,
      decision public.narrative_candidate_decision
    )
    left join public.career_narrative_candidates as candidate
      on candidate.id = decision.id
      and candidate.import_id = owned_import.id
      and candidate.user_id = owned_import.user_id
    where candidate.id is null
      or decision.decision not in ('confirmed', 'rejected')
  ) then
    raise exception 'NARRATIVE_DECISION_SET_MISMATCH' using errcode = 'P0001';
  end if;

  update public.career_narrative_candidates as candidate
  set decision = review.decision
  from jsonb_to_recordset(p_decisions) as review(
    id uuid,
    decision public.narrative_candidate_decision
  )
  where candidate.id = review.id
    and candidate.import_id = owned_import.id
    and candidate.user_id = owned_import.user_id;

  return public.activate_career_narrative_import_v2(
    owned_import.user_id,
    owned_import.id
  );
end;
$$;

comment on function public.review_and_activate_career_narrative_import_v1(uuid, jsonb) is
  'Atomically validates every decision for the authenticated caller-owned staged narrative import and activates the selected profile records.';

revoke all on function public.review_and_activate_career_narrative_import_v1(uuid, jsonb) from public;
grant execute on function public.review_and_activate_career_narrative_import_v1(uuid, jsonb) to authenticated;
revoke execute on function public.activate_career_narrative_import_v1(uuid, uuid) from authenticated;
revoke execute on function public.activate_career_narrative_import_v2(uuid, uuid) from authenticated;

commit;
