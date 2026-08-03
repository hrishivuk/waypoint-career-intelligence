begin;

create or replace function public.update_job_requirement_criticality_v1(
  target_analysis_id uuid,
  target_position integer,
  target_criticality public.job_requirement_criticality
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owned_analysis public.analyses%rowtype;
  owned_requirement public.job_requirements%rowtype;
  requirement_priority text;
  updated_requirements jsonb;
begin
  if target_position < 0 then
    raise exception 'Invalid requirement position.' using errcode = '22023';
  end if;

  select *
  into owned_analysis
  from public.analyses
  where id = target_analysis_id
  for update;

  if not found then
    return false;
  end if;

  if jsonb_typeof(owned_analysis.result -> 'requirements') <> 'array'
    or jsonb_array_length(owned_analysis.result -> 'requirements') <= target_position
    or jsonb_typeof(owned_analysis.result -> 'requirements' -> target_position) <> 'object'
  then
    raise exception 'ANALYSIS_REQUIREMENT_MISMATCH' using errcode = 'P0001';
  end if;

  if (owned_analysis.result -> 'requirements' -> target_position) ? 'position'
    and (owned_analysis.result -> 'requirements' -> target_position ->> 'position')::integer <> target_position
  then
    raise exception 'ANALYSIS_REQUIREMENT_MISMATCH' using errcode = 'P0001';
  end if;

  select *
  into owned_requirement
  from public.job_requirements
  where user_id = owned_analysis.user_id
    and job_id = owned_analysis.job_id
    and position = target_position
  for update;

  if not found then
    return false;
  end if;

  requirement_priority := case
    when target_criticality = 'unclear' then 'unclear'
    when target_criticality in ('preferred', 'bonus') then 'preferred'
    else 'required'
  end;

  update public.job_requirements
  set
    criticality = target_criticality,
    criticality_is_explicit = true,
    is_required = requirement_priority = 'required',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'priority', requirement_priority,
      'corrected_by_user', true
    )
  where id = owned_requirement.id;

  select coalesce(
    jsonb_agg(
      case
        when element.ordinality - 1 = target_position then
          element.value || jsonb_build_object(
            'criticality', target_criticality::text,
            'required', requirement_priority = 'required'
          )
        else element.value
      end
      order by element.ordinality
    ),
    '[]'::jsonb
  )
  into updated_requirements
  from jsonb_array_elements(
    coalesce(owned_analysis.result -> 'requirements', '[]'::jsonb)
  ) with ordinality as element(value, ordinality);

  update public.analyses
  set
    result = jsonb_set(
      jsonb_set(
        jsonb_set(
          owned_analysis.result,
          '{requirements}',
          updated_requirements,
          true
        ),
        '{requiresReanalysis}',
        'true'::jsonb,
        true
      ),
      '{reanalysisReason}',
      to_jsonb('requirement_criticality_changed'::text),
      true
    ),
    updated_at = timezone('utc', now())
  where id = owned_analysis.id;

  return true;
end;
$$;

comment on function public.update_job_requirement_criticality_v1(uuid, integer, public.job_requirement_criticality) is
  'Atomically updates an owned job requirement and its saved analysis JSON snapshot. RLS applies through security invoker.';

revoke all on function public.update_job_requirement_criticality_v1(uuid, integer, public.job_requirement_criticality) from public;
grant execute on function public.update_job_requirement_criticality_v1(uuid, integer, public.job_requirement_criticality) to authenticated;

commit;
