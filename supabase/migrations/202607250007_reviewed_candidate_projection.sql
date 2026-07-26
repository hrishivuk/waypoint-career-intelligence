begin;

create type public.handover_projection_status as enum (
  'projected',
  'reconciled'
);

create type public.handover_projection_target as enum (
  'career_profile_facts',
  'career_modes',
  'typed_preferences',
  'decision_policies',
  'evidence_records',
  'skills',
  'capability_assessments',
  'temporary_states',
  'historical_observations',
  'knowledge_uncertainties',
  'cv_artifacts'
);

create table public.handover_candidate_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  candidate_id uuid not null,
  review_revision integer not null check (review_revision > 0),
  effective_record_hash text not null
    check (effective_record_hash ~ '^[0-9a-f]{64}$'),
  target_table public.handover_projection_target not null,
  target_id uuid not null,
  status public.handover_projection_status not null,
  projected_by_auth_user_id uuid references auth.users(id) on delete set null,
  projected_by_role text not null,
  projected_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  unique (candidate_id),
  unique (id, user_id),
  foreign key (candidate_id, user_id)
    references public.handover_import_candidates(id, user_id) on delete restrict
);

create index handover_projections_owner_created_idx
  on public.handover_candidate_projections (user_id, projected_at desc);
create index handover_projections_dependency_idx
  on public.handover_candidate_projections
    (user_id, candidate_id, target_table, status);

alter table public.handover_candidate_projections enable row level security;

create policy "owners can read handover projections"
on public.handover_candidate_projections for select to authenticated
using (public.owns_prototype_user(user_id));

-- Source precision is authoritative; never invent a timestamp for a
-- year/month/day historical observation solely to satisfy storage.
alter table public.historical_observations
  alter column observed_at drop not null;
alter table public.capability_assessments
  alter column assessed_at drop not null;

create or replace function public.project_reviewed_handover_candidate_v1_1(
  p_user_id uuid,
  p_candidate_id uuid
)
returns table (
  candidate_id uuid,
  target_table public.handover_projection_target,
  target_id uuid,
  already_projected boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.handover_import_candidates%rowtype;
  existing_projection public.handover_candidate_projections%rowtype;
  effective_record jsonb;
  effective_hash text;
  record_type text;
  stable_id text;
  target_uuid uuid;
  mode_uuid uuid;
  dependency_uuid uuid;
  source_document_uuid uuid;
  projection_target public.handover_projection_target;
  projection_status public.handover_projection_status := 'projected';
  confidence_value numeric(4,3);
  criticality_value public.knowledge_criticality;
  stale_value public.staleness_behavior;
  reviewer_id uuid := auth.uid();
  reviewer_role text := coalesce(auth.role(), 'unknown');
  confirmed_time timestamptz := timezone('utc', now());
  reference text;
  dependency_count integer;
begin
  if reviewer_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'candidate projection is not authorised';
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
  if candidate.review_status not in ('confirmed', 'corrected') then
    raise exception 'only confirmed or corrected candidates can be projected';
  end if;

  effective_record := case
    when candidate.review_status = 'corrected' then candidate.corrected_record
    else candidate.exact_record
  end;
  if effective_record is null
    or effective_record ->> 'id' is distinct from candidate.stable_record_id
    or effective_record ->> 'type' is distinct from candidate.record_type
    or effective_record ->> 'status' is distinct from 'proposed'
  then
    raise exception 'reviewed candidate has an invalid effective record';
  end if;

  effective_hash := encode(
    extensions.digest(convert_to(effective_record::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select projection.*
  into existing_projection
  from public.handover_candidate_projections as projection
  where projection.candidate_id = candidate.id
    and projection.user_id = candidate.user_id;

  if found then
    if existing_projection.effective_record_hash <> effective_hash
      or existing_projection.review_revision <> candidate.review_revision
    then
      raise exception
        'candidate was already projected from a different reviewed revision';
    end if;
    return query
    select
      candidate.id,
      existing_projection.target_table,
      existing_projection.target_id,
      true;
    return;
  end if;

  record_type := effective_record ->> 'type';
  stable_id := effective_record ->> 'id';
  confidence_value := case effective_record ->> 'confidence'
    when 'high' then 1
    when 'medium' then 0.667
    when 'low' then 0.333
    else null
  end;
  criticality_value := coalesce(
    (effective_record ->> 'criticality')::public.knowledge_criticality,
    'normal'
  );
  stale_value := case criticality_value
    when 'critical' then 'force_investigate'::public.staleness_behavior
    when 'important' then 'reduce_confidence'::public.staleness_behavior
    else 'warn'::public.staleness_behavior
  end;

  if effective_record ? 'mode' then
    select mode.id
    into mode_uuid
    from public.career_modes as mode
    where mode.user_id = p_user_id
      and mode.slug = effective_record ->> 'mode'
      and mode.status = 'confirmed';
    if not found then
      raise exception 'referenced confirmed career mode must be projected first';
    end if;
  end if;

  case record_type
    when 'stable_fact' then
      projection_target := 'career_profile_facts';
      target_uuid := gen_random_uuid();
      insert into public.career_profile_facts (
        id, user_id, category, fact_key, value, status, confidence,
        source_document_id, extraction_metadata, reviewed_at,
        source_valid_from, source_valid_until, source_last_confirmed,
        source_review_after, criticality, stale_behavior
      ) values (
        target_uuid,
        p_user_id,
        coalesce(nullif(effective_record ->> 'category', ''), 'other'),
        'handover:' || stable_id,
        jsonb_build_object(
          'statement', effective_record ->> 'statement',
          'evidence_refs', coalesce(effective_record -> 'evidence_refs', '[]'::jsonb)
        ),
        'confirmed',
        confidence_value,
        (select run.source_document_id
          from public.handover_import_runs run
          where run.id = candidate.import_run_id),
        jsonb_build_object(
          'handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance',
          'tags', coalesce(effective_record -> 'tags', '[]'::jsonb)
        ),
        confirmed_time,
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value,
        stale_value
      );

    when 'career_mode' then
      projection_target := 'career_modes';
      select mode.id
      into target_uuid
      from public.career_modes as mode
      where mode.user_id = p_user_id and mode.slug = stable_id
      for update;
      if found then
        -- Existing seeded/confirmed mode is authoritative. Reconciliation
        -- records provenance without replacing, deactivating, or downgrading it.
        projection_status := 'reconciled';
      else
        target_uuid := gen_random_uuid();
        insert into public.career_modes (
          id, user_id, slug, name, purpose, is_active, display_priority,
          target_role_families, prohibited_role_families, status, confidence,
          source_type, source_ref, source_start_date, source_end_date,
          source_last_confirmed, source_review_after, criticality,
          stale_behavior, last_confirmed_at, tags
        ) values (
          target_uuid,
          p_user_id,
          stable_id,
          effective_record ->> 'name',
          effective_record ->> 'purpose',
          coalesce((effective_record ->> 'active')::boolean, false),
          (effective_record ->> 'priority')::integer,
          coalesce(effective_record -> 'target_role_families', '[]'::jsonb),
          coalesce(effective_record -> 'prohibited_role_families', '[]'::jsonb),
          'confirmed',
          confidence_value,
          'chat_handover',
          jsonb_build_object(
            'handover_record_id', stable_id,
            'provenance', effective_record -> 'provenance'
          ),
          effective_record -> 'start_date',
          effective_record -> 'end_date',
          effective_record -> 'last_confirmed_at',
          effective_record -> 'review_after',
          criticality_value,
          stale_value,
          confirmed_time,
          array(select jsonb_array_elements_text(
            coalesce(effective_record -> 'tags', '[]'::jsonb)))
        );
      end if;

    when 'preference' then
      projection_target := 'typed_preferences';
      target_uuid := gen_random_uuid();
      insert into public.typed_preferences (
        id, user_id, mode_id, record_type, subject, value, value_shape,
        strength, reason, exceptions, status, confidence, source_type,
        source_ref, last_confirmed_at, tags, source_valid_from,
        source_valid_until, source_last_confirmed, source_review_after,
        criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, mode_uuid, 'preference',
        effective_record ->> 'subject',
        coalesce(effective_record -> 'value', effective_record -> 'ordered_values'),
        case when effective_record ? 'ordered_values'
          then 'ordered'::public.preference_value_shape
          else 'scalar'::public.preference_value_shape end,
        (effective_record ->> 'strength')::public.preference_strength,
        effective_record ->> 'reason',
        coalesce(effective_record -> 'exceptions', '[]'::jsonb),
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance'),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

    when 'working_style' then
      projection_target := 'typed_preferences';
      target_uuid := gen_random_uuid();
      insert into public.typed_preferences (
        id, user_id, mode_id, record_type, subject, value, value_shape,
        strength, reason, exceptions, status, confidence, source_type,
        source_ref, last_confirmed_at, tags, source_valid_from,
        source_valid_until, source_last_confirmed, source_review_after,
        criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, mode_uuid, 'working_style',
        effective_record ->> 'trait',
        to_jsonb(effective_record ->> 'description'),
        'scalar', 'neutral',
        effective_record ->> 'career_relevance',
        coalesce(effective_record -> 'exceptions', '[]'::jsonb),
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance'),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

    when 'decision_policy' then
      projection_target := 'decision_policies';
      target_uuid := gen_random_uuid();
      insert into public.decision_policies (
        id, user_id, mode_id, policy_type, rule_text, enforcement,
        task_scopes, priority, parameters, exceptions, status, confidence,
        source_type, source_ref, last_confirmed_at, tags, decision_key,
        condition_operator, condition_value, effect, numeric_modifier,
        source_valid_from, source_valid_until, source_last_confirmed,
        source_review_after, criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, mode_uuid,
        effective_record ->> 'policy_type',
        effective_record ->> 'rule',
        (effective_record ->> 'enforcement')::public.policy_enforcement,
        array(select jsonb_array_elements_text(effective_record -> 'task_scopes')),
        (effective_record ->> 'priority')::integer,
        '{}'::jsonb,
        coalesce(effective_record -> 'exceptions', '[]'::jsonb),
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance'),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record ->> 'decision_key',
        case when effective_record ? 'operator'
          then (effective_record ->> 'operator')::public.policy_condition_operator
          else null end,
        effective_record -> 'condition_value',
        (effective_record ->> 'effect')::public.policy_effect,
        case when effective_record ? 'modifier'
          then (effective_record ->> 'modifier')::numeric else null end,
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

      for reference in
        select jsonb_array_elements_text(
          coalesce(effective_record -> 'cv_artifact_refs', '[]'::jsonb))
      loop
        select projection.target_id
        into dependency_uuid
        from public.handover_import_candidates dependency
        join public.handover_candidate_projections projection
          on projection.candidate_id = dependency.id
          and projection.user_id = dependency.user_id
        where dependency.user_id = p_user_id
          and dependency.stable_record_id = reference
          and projection.target_table = 'cv_artifacts'
        order by projection.projected_at desc
        limit 1;
        if not found then
          raise exception 'referenced CV artefact % must be projected first', reference;
        end if;
        insert into public.decision_policy_cv_artifacts (
          user_id, decision_policy_id, cv_artifact_id
        ) values (p_user_id, target_uuid, dependency_uuid);
      end loop;

    when 'skill' then
      projection_target := 'skills';
      target_uuid := gen_random_uuid();
      insert into public.skills (
        id, user_id, name, category, aliases, status, confidence,
        source_type, source_ref, last_confirmed_at, tags,
        source_valid_from, source_valid_until, source_last_confirmed,
        source_review_after, criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, effective_record ->> 'name',
        effective_record ->> 'category',
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'aliases', '[]'::jsonb))),
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance'),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

    when 'evidence' then
      projection_target := 'evidence_records';
      if effective_record ? 'parent_ref' then
        select projection.target_id
        into dependency_uuid
        from public.handover_import_candidates dependency
        join public.handover_candidate_projections projection
          on projection.candidate_id = dependency.id
          and projection.user_id = dependency.user_id
        where dependency.user_id = p_user_id
          and dependency.stable_record_id = effective_record ->> 'parent_ref'
          and projection.target_table = 'evidence_records'
        order by projection.projected_at desc
        limit 1;
        if not found then
          raise exception 'parent evidence must be projected first';
        end if;
      else
        dependency_uuid := null;
      end if;
      target_uuid := gen_random_uuid();
      insert into public.evidence_records (
        id, user_id, mode_id, parent_evidence_id, kind, title, narrative,
        organisation, attributes, status, confidence, source_type, source_ref,
        last_confirmed_at, tags, source_occurred_from, source_occurred_until,
        source_valid_from, source_valid_until, source_last_confirmed,
        source_review_after, criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, mode_uuid, dependency_uuid,
        (effective_record ->> 'evidence_type')::public.evidence_kind,
        effective_record ->> 'title',
        effective_record ->> 'summary',
        effective_record ->> 'organisation',
        jsonb_build_object(
          'outcome', effective_record -> 'outcome',
          'technologies', coalesce(effective_record -> 'technologies', '[]'::jsonb),
          'source_document_ref', effective_record -> 'source_document_ref'
        ),
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance'),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record -> 'start_date',
        effective_record -> 'end_date',
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

    when 'capability_assessment' then
      projection_target := 'capability_assessments';
      select projection.target_id
      into dependency_uuid
      from public.handover_import_candidates dependency
      join public.handover_candidate_projections projection
        on projection.candidate_id = dependency.id
        and projection.user_id = dependency.user_id
      where dependency.user_id = p_user_id
        and dependency.stable_record_id = effective_record ->> 'skill_ref'
        and projection.target_table = 'skills'
      order by projection.projected_at desc
      limit 1;
      if not found then
        raise exception 'referenced skill must be projected first';
      end if;
      target_uuid := gen_random_uuid();
      insert into public.capability_assessments (
        id, user_id, skill_id, mode_id, current_level, target_level, context,
        development_objective, assessed_at, status, confidence, source_type, source_ref,
        last_confirmed_at, tags, source_assessed_date, source_valid_from,
        source_valid_until, source_last_confirmed, source_review_after,
        criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, dependency_uuid, mode_uuid,
        effective_record ->> 'current_level',
        effective_record ->> 'target_level',
        effective_record ->> 'context',
        effective_record ->> 'development_objective',
        null,
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance'),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record -> 'assessment_date',
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

      for reference in
        select jsonb_array_elements_text(
          coalesce(effective_record -> 'evidence_refs', '[]'::jsonb))
      loop
        select projection.target_id
        into dependency_uuid
        from public.handover_import_candidates dependency
        join public.handover_candidate_projections projection
          on projection.candidate_id = dependency.id
          and projection.user_id = dependency.user_id
        where dependency.user_id = p_user_id
          and dependency.stable_record_id = reference
          and projection.target_table = 'evidence_records'
        order by projection.projected_at desc
        limit 1;
        if not found then
          raise exception 'referenced capability evidence % must be projected first',
            reference;
        end if;
        insert into public.capability_evidence (
          user_id, capability_assessment_id, evidence_record_id
        ) values (p_user_id, target_uuid, dependency_uuid);
      end loop;

    when 'cv_artifact' then
      projection_target := 'cv_artifacts';
      select count(*), (array_agg(document.id order by document.created_at desc))[1]
      into dependency_count, source_document_uuid
      from public.documents document
      where document.user_id = p_user_id
        and (
          document.id::text = effective_record ->> 'source_document_ref'
          or document.filename = effective_record ->> 'source_document_ref'
        );
      if dependency_count = 0 then
        raise exception 'CV source document must exist before projection';
      elsif dependency_count > 1 then
        raise exception 'CV source document reference is ambiguous';
      end if;
      reference := coalesce(
        effective_record ->> 'supersedes',
        effective_record ->> 'supersedes_ref'
      );
      if reference is not null then
        select projection.target_id
        into dependency_uuid
        from public.handover_import_candidates dependency
        join public.handover_candidate_projections projection
          on projection.candidate_id = dependency.id
          and projection.user_id = dependency.user_id
        where dependency.user_id = p_user_id
          and dependency.stable_record_id = reference
          and projection.target_table = 'cv_artifacts'
        order by projection.projected_at desc
        limit 1;
        if not found then
          raise exception 'superseded CV artefact must be projected first';
        end if;
      else
        dependency_uuid := null;
      end if;
      target_uuid := gen_random_uuid();
      insert into public.cv_artifacts (
        id, user_id, stable_id, name, intended_role_families,
        source_document_id, revision_identifier, emphasis_summary,
        supersedes_artifact_id, status, confidence, source_type, source_ref,
        source_valid_from, source_valid_until, source_last_confirmed,
        source_review_after, last_reviewed_date, last_confirmed_at,
        criticality, stale_behavior, tags
      ) values (
        target_uuid, p_user_id, stable_id, effective_record ->> 'name',
        array(select jsonb_array_elements_text(
          effective_record -> 'intended_role_families')),
        source_document_uuid,
        effective_record ->> 'revision',
        effective_record ->> 'emphasis',
        dependency_uuid,
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance'),
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        effective_record -> 'last_reviewed_at',
        confirmed_time,
        criticality_value, stale_value,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb)))
      );

    when 'temporary_state' then
      projection_target := 'temporary_states';
      target_uuid := gen_random_uuid();
      insert into public.temporary_states (
        id, user_id, mode_id, state_type, value, status, confidence,
        source_type, source_ref, last_confirmed_at, tags, source_valid_from,
        source_valid_until, source_last_confirmed, source_review_after,
        criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, mode_uuid,
        effective_record ->> 'state_type',
        effective_record -> 'value',
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance',
          'reason', effective_record -> 'reason'),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

    when 'historical_observation' then
      projection_target := 'historical_observations';
      target_uuid := gen_random_uuid();
      insert into public.historical_observations (
        id, user_id, mode_id, observation_type, observation, outcome,
        observed_at, status, confidence, source_type, source_ref,
        last_confirmed_at, tags, source_observed_date, source_valid_from,
        source_valid_until, source_last_confirmed, source_review_after,
        criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, mode_uuid,
        coalesce(nullif(effective_record ->> 'decision', ''), 'observation'),
        effective_record ->> 'observation',
        case when jsonb_typeof(effective_record -> 'outcome') = 'object'
          then effective_record -> 'outcome'
          else jsonb_build_object('value', effective_record -> 'outcome') end,
        null,
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance',
          'related_refs', coalesce(effective_record -> 'related_refs', '[]'::jsonb)),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record -> 'observed_at',
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

    when 'uncertainty' then
      projection_target := 'knowledge_uncertainties';
      target_uuid := gen_random_uuid();
      insert into public.knowledge_uncertainties (
        id, user_id, mode_id, topic, description, resolution_needed,
        contradicts, candidate_values, status, confidence, source_type,
        source_ref, last_confirmed_at, tags, source_valid_from,
        source_valid_until, source_last_confirmed, source_review_after,
        criticality, stale_behavior
      ) values (
        target_uuid, p_user_id, mode_uuid,
        effective_record ->> 'topic',
        effective_record ->> 'description',
        effective_record ->> 'resolution_needed',
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'contradicts', '[]'::jsonb))),
        coalesce(effective_record -> 'candidate_values', '[]'::jsonb),
        'confirmed', confidence_value, 'chat_handover',
        jsonb_build_object('handover_record_id', stable_id,
          'provenance', effective_record -> 'provenance'),
        confirmed_time,
        array(select jsonb_array_elements_text(
          coalesce(effective_record -> 'tags', '[]'::jsonb))),
        effective_record -> 'valid_from',
        effective_record -> 'valid_until',
        effective_record -> 'last_confirmed_at',
        effective_record -> 'review_after',
        criticality_value, stale_value
      );

    else
      raise exception 'unsupported handover record type: %', record_type;
  end case;

  insert into public.handover_candidate_projections (
    user_id, candidate_id, review_revision, effective_record_hash,
    target_table, target_id, status, projected_by_auth_user_id,
    projected_by_role, metadata
  ) values (
    p_user_id, candidate.id, candidate.review_revision, effective_hash,
    projection_target, target_uuid, projection_status, reviewer_id,
    reviewer_role,
    jsonb_build_object(
      'stable_record_id', stable_id,
      'record_type', record_type,
      'review_status', candidate.review_status
    )
  );

  return query select candidate.id, projection_target, target_uuid, false;
end;
$$;

revoke all on function public.project_reviewed_handover_candidate_v1_1(
  uuid, uuid
) from public;
grant execute on function public.project_reviewed_handover_candidate_v1_1(
  uuid, uuid
) to authenticated, service_role;

comment on table public.handover_candidate_projections is
  'Audited idempotency ledger for reviewed candidate projection. Source review and typed projection remain separate.';
comment on function public.project_reviewed_handover_candidate_v1_1(uuid, uuid) is
  'Transactionally projects one reviewed v1.1 candidate through an explicit type mapping. Dependencies must already be projected.';

commit;
