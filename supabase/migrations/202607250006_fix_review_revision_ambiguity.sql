begin;

create or replace function public.review_handover_candidate_v1_1(
  p_user_id uuid,
  p_candidate_id uuid,
  p_expected_revision integer,
  p_decision public.handover_review_status,
  p_corrected_record jsonb default null,
  p_notes text default null
)
returns table (
  candidate_id uuid,
  review_status public.handover_review_status,
  review_revision integer,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.handover_import_candidates%rowtype;
  decision_time timestamptz := timezone('utc', now());
  reviewer_id uuid := auth.uid();
  reviewer_role text := coalesce(auth.role(), 'unknown');
begin
  if reviewer_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'candidate review is not authorised';
  end if;
  if p_decision = 'pending' then
    raise exception 'pending is not a review decision';
  end if;
  if p_expected_revision < 0 then
    raise exception 'expected revision must not be negative';
  end if;

  select staged.*
  into candidate
  from public.handover_import_candidates as staged
  where staged.id = p_candidate_id
    and staged.user_id = p_user_id
  for update;

  if not found then
    raise exception 'handover candidate not found';
  end if;
  if candidate.review_revision <> p_expected_revision then
    raise exception 'handover candidate review revision conflict';
  end if;

  if p_decision = 'corrected' then
    if p_corrected_record is null
      or jsonb_typeof(p_corrected_record) <> 'object'
      or p_corrected_record ->> 'id' is distinct from candidate.stable_record_id
      or p_corrected_record ->> 'type' is distinct from candidate.record_type
      or p_corrected_record ->> 'status' is distinct from 'proposed'
    then
      raise exception 'corrected record must preserve id/type and remain proposed';
    end if;
  elsif p_corrected_record is not null then
    raise exception 'corrected record is only valid for a corrected decision';
  end if;

  update public.handover_import_candidates as staged
  set
    review_status = p_decision,
    corrected_record = p_corrected_record,
    review_notes = nullif(btrim(p_notes), ''),
    reviewed_at = decision_time,
    reviewed_by_auth_user_id = reviewer_id,
    reviewed_by_role = reviewer_role,
    review_revision = candidate.review_revision + 1
  where staged.id = candidate.id
    and staged.user_id = candidate.user_id
    and staged.review_revision = p_expected_revision;

  if not found then
    raise exception 'handover candidate review revision conflict';
  end if;

  insert into public.handover_candidate_review_events (
    user_id,
    candidate_id,
    from_status,
    to_status,
    revision,
    corrected_record,
    notes,
    reviewed_by_auth_user_id,
    reviewed_by_role
  )
  values (
    candidate.user_id,
    candidate.id,
    candidate.review_status,
    p_decision,
    candidate.review_revision + 1,
    p_corrected_record,
    nullif(btrim(p_notes), ''),
    reviewer_id,
    reviewer_role
  );

  return query
  select
    candidate.id,
    p_decision,
    candidate.review_revision + 1,
    decision_time;
end;
$$;

revoke all on function public.review_handover_candidate_v1_1(
  uuid, uuid, integer, public.handover_review_status, jsonb, text
) from public;
grant execute on function public.review_handover_candidate_v1_1(
  uuid, uuid, integer, public.handover_review_status, jsonb, text
) to authenticated, service_role;

commit;
