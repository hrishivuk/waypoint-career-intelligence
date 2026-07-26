begin;

alter table public.skill_model_review_items
  add column projected_record_id uuid,
  add column projected_assessment_id uuid,
  add column projected_at timestamptz;

create or replace function public.project_skill_model_review(
  requested_batch_id uuid,
  requested_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_record public.skill_model_review_batches%rowtype;
  item_record public.skill_model_review_items%rowtype;
  target_skill_id uuid;
  target_competency_id uuid;
  target_assessment_id uuid;
  effective_level public.capability_proficiency_level;
  skill_category public.skill_category_code;
  competency_category public.competency_category_code;
  canonical_slug_value text;
  source_name text;
  now_value timestamptz := timezone('utc', now());
  projected_skills integer := 0;
  projected_competencies integer := 0;
  rejected_items integer := 0;
begin
  select *
  into batch_record
  from public.skill_model_review_batches
  where id = requested_batch_id
    and user_id = requested_user_id
  for update;

  if not found then
    raise exception 'skill review batch not found';
  end if;

  if exists (
    select 1
    from public.skill_model_review_items
    where batch_id = requested_batch_id
      and user_id = requested_user_id
      and review_status = 'pending'
  ) then
    raise exception 'all skill review items must be reviewed before projection';
  end if;

  for item_record in
    select *
    from public.skill_model_review_items
    where batch_id = requested_batch_id
      and user_id = requested_user_id
    order by destination, canonical_name
    for update
  loop
    if item_record.review_status = 'rejected' then
      update public.skill_model_review_items
      set projected_record_id = null,
          projected_assessment_id = null,
          projected_at = now_value,
          updated_at = now_value
      where id = item_record.id;
      rejected_items := rejected_items + 1;
      continue;
    end if;

    effective_level := coalesce(
      item_record.corrected_level,
      item_record.proposed_level
    );
    if effective_level is null then
      raise exception 'review item % has no effective level', item_record.id;
    end if;

    canonical_slug_value := trim(both '-' from regexp_replace(
      lower(item_record.canonical_name),
      '[^a-z0-9]+',
      '-',
      'g'
    ));

    if item_record.destination = 'skill' then
      skill_category := case lower(item_record.canonical_name)
        when 'javascript' then 'programming_language'
        when 'typescript' then 'programming_language'
        when 'react' then 'framework'
        when 'react native' then 'framework'
        when 'angular' then 'framework'
        when 'redux' then 'library'
        when 'figma' then 'design_tool'
        when 'git' then 'tool'
        when 'vite' then 'tool'
        when 'firebase' then 'platform'
        when 'firebase hosting' then 'cloud_service'
        when 'firestore' then 'database'
        when 'supabase' then 'platform'
        when 'postgresql' then 'database'
        when 'agile (scrum)' then 'methodology'
        else 'technical_skill'
      end::public.skill_category_code;

      select id
      into target_skill_id
      from public.skills
      where user_id = requested_user_id
        and (
          canonical_slug = canonical_slug_value
          or lower(btrim(name)) = lower(btrim(item_record.canonical_name))
        )
      order by (canonical_slug = canonical_slug_value) desc, created_at
      limit 1;

      if target_skill_id is null then
        insert into public.skills (
          user_id, name, category, primary_category, canonical_slug,
          taxonomy_version, description, aliases, status, confidence,
          source_type, source_ref, last_confirmed_at, tags
        ) values (
          requested_user_id,
          item_record.canonical_name,
          replace(skill_category::text, '_', ' '),
          skill_category,
          canonical_slug_value,
          'waypoint-skill-taxonomy-v2',
          item_record.rationale,
          item_record.source_skills,
          'confirmed',
          item_record.assessment_confidence,
          'skill_model_review',
          jsonb_build_object(
            'batch_id', requested_batch_id,
            'review_item_id', item_record.id
          ),
          now_value,
          array['skill-model-v2']
        )
        returning id into target_skill_id;
      else
        update public.skills
        set name = item_record.canonical_name,
            category = replace(skill_category::text, '_', ' '),
            primary_category = skill_category,
            canonical_slug = canonical_slug_value,
            taxonomy_version = 'waypoint-skill-taxonomy-v2',
            description = coalesce(description, item_record.rationale),
            aliases = (
              select array_agg(distinct alias_value)
              from unnest(
                coalesce(aliases, '{}'::text[]) || item_record.source_skills
              ) alias_value
            ),
            status = 'confirmed',
            confidence = item_record.assessment_confidence,
            source_type = 'skill_model_review',
            source_ref = jsonb_build_object(
              'batch_id', requested_batch_id,
              'review_item_id', item_record.id
            ),
            last_confirmed_at = now_value,
            updated_at = now_value
        where id = target_skill_id;
      end if;

      foreach source_name in array item_record.source_skills
      loop
        if lower(btrim(source_name)) <> lower(btrim(item_record.canonical_name)) then
          insert into public.skill_aliases (user_id, skill_id, alias)
          select requested_user_id, target_skill_id, source_name
          where not exists (
            select 1
            from public.skill_aliases
            where user_id = requested_user_id
              and lower(btrim(alias)) = lower(btrim(source_name))
          );
        end if;

        update public.skills
        set status = 'superseded',
            superseded_by_skill_id = target_skill_id,
            updated_at = now_value
        where user_id = requested_user_id
          and id <> target_skill_id
          and lower(btrim(name)) = lower(btrim(source_name));
      end loop;

      update public.capability_assessments
      set status = 'superseded',
          updated_at = now_value
      where user_id = requested_user_id
        and skill_id = target_skill_id
        and status = 'confirmed'
        and id is distinct from item_record.projected_assessment_id;

      if item_record.projected_assessment_id is not null then
        update public.capability_assessments
        set current_level = effective_level::text,
            proficiency_level = effective_level,
            context = item_record.rationale,
            assessment_basis = array_to_string(item_record.source_skills, ', '),
            assessment_confidence = item_record.assessment_confidence,
            is_self_assessed = true,
            assessed_at = now_value,
            status = 'confirmed',
            confidence = item_record.assessment_confidence,
            source_type = 'skill_model_review',
            source_ref = jsonb_build_object(
              'batch_id', requested_batch_id,
              'review_item_id', item_record.id
            ),
            last_confirmed_at = now_value,
            updated_at = now_value
        where id = item_record.projected_assessment_id
          and user_id = requested_user_id
        returning id into target_assessment_id;
      else
        target_assessment_id := null;
      end if;

      if target_assessment_id is null then
        insert into public.capability_assessments (
          user_id, skill_id, current_level, proficiency_level, context,
          assessment_basis, assessment_confidence, is_self_assessed,
          assessed_at, status, confidence, source_type, source_ref,
          last_confirmed_at, tags
        ) values (
          requested_user_id,
          target_skill_id,
          effective_level::text,
          effective_level,
          item_record.rationale,
          array_to_string(item_record.source_skills, ', '),
          item_record.assessment_confidence,
          true,
          now_value,
          'confirmed',
          item_record.assessment_confidence,
          'skill_model_review',
          jsonb_build_object(
            'batch_id', requested_batch_id,
            'review_item_id', item_record.id
          ),
          now_value,
          array['skill-model-v2']
        )
        returning id into target_assessment_id;
      end if;

      insert into public.skill_assessment_events (
        user_id, capability_assessment_id, skill_id, proficiency_level,
        assessment_confidence, context, source_type, source_ref,
        confirmed_by_user, assessed_at
      )
      select
        requested_user_id,
        target_assessment_id,
        target_skill_id,
        effective_level,
        item_record.assessment_confidence,
        item_record.rationale,
        'skill_model_review',
        jsonb_build_object(
          'batch_id', requested_batch_id,
          'review_item_id', item_record.id
        ),
        true,
        now_value
      where not exists (
        select 1
        from public.skill_assessment_events
        where user_id = requested_user_id
          and source_ref ->> 'review_item_id' = item_record.id::text
      );

      update public.skill_model_review_items
      set projected_record_id = target_skill_id,
          projected_assessment_id = target_assessment_id,
          projected_at = now_value,
          updated_at = now_value
      where id = item_record.id;
      projected_skills := projected_skills + 1;
    else
      competency_category := case lower(item_record.canonical_name)
        when 'cross-functional collaboration' then 'collaboration'
        when 'code reviews' then 'collaboration'
        when 'independent feature delivery' then 'delivery'
        when 'technical documentation' then 'communication'
        else 'other'
      end::public.competency_category_code;

      insert into public.professional_competencies (
        user_id, canonical_slug, name, category, description, status,
        confidence, source_type, source_ref, last_confirmed_at, tags
      ) values (
        requested_user_id,
        canonical_slug_value,
        item_record.canonical_name,
        competency_category,
        item_record.rationale,
        'confirmed',
        item_record.assessment_confidence,
        'skill_model_review',
        jsonb_build_object(
          'batch_id', requested_batch_id,
          'review_item_id', item_record.id
        ),
        now_value,
        array['skill-model-v2']
      )
      on conflict (user_id, canonical_slug) do update
      set name = excluded.name,
          category = excluded.category,
          description = excluded.description,
          status = 'confirmed',
          confidence = excluded.confidence,
          source_type = excluded.source_type,
          source_ref = excluded.source_ref,
          last_confirmed_at = excluded.last_confirmed_at,
          updated_at = now_value
      returning id into target_competency_id;

      update public.competency_assessments
      set status = 'superseded',
          updated_at = now_value
      where user_id = requested_user_id
        and competency_id = target_competency_id
        and status = 'confirmed'
        and id is distinct from item_record.projected_assessment_id;

      if item_record.projected_assessment_id is not null then
        update public.competency_assessments
        set proficiency_level = effective_level,
            context = item_record.rationale,
            assessment_confidence = item_record.assessment_confidence,
            is_self_assessed = true,
            status = 'confirmed',
            source_type = 'skill_model_review',
            source_ref = jsonb_build_object(
              'batch_id', requested_batch_id,
              'review_item_id', item_record.id
            ),
            assessed_at = now_value,
            last_confirmed_at = now_value,
            updated_at = now_value
        where id = item_record.projected_assessment_id
          and user_id = requested_user_id
        returning id into target_assessment_id;
      else
        target_assessment_id := null;
      end if;

      if target_assessment_id is null then
        insert into public.competency_assessments (
          user_id, competency_id, proficiency_level, context,
          assessment_confidence, is_self_assessed, status, source_type,
          source_ref, assessed_at, last_confirmed_at
        ) values (
          requested_user_id,
          target_competency_id,
          effective_level,
          item_record.rationale,
          item_record.assessment_confidence,
          true,
          'confirmed',
          'skill_model_review',
          jsonb_build_object(
            'batch_id', requested_batch_id,
            'review_item_id', item_record.id
          ),
          now_value,
          now_value
        )
        returning id into target_assessment_id;
      end if;

      update public.skill_model_review_items
      set projected_record_id = target_competency_id,
          projected_assessment_id = target_assessment_id,
          projected_at = now_value,
          updated_at = now_value
      where id = item_record.id;
      projected_competencies := projected_competencies + 1;
    end if;
  end loop;

  update public.skill_model_review_batches
  set status = 'projected',
      updated_at = now_value
  where id = requested_batch_id
    and user_id = requested_user_id;

  return jsonb_build_object(
    'batchId', requested_batch_id,
    'skills', projected_skills,
    'competencies', projected_competencies,
    'rejected', rejected_items,
    'total', projected_skills + projected_competencies + rejected_items
  );
end;
$$;

revoke all on function public.project_skill_model_review(uuid, uuid) from public;
grant execute on function public.project_skill_model_review(uuid, uuid)
to service_role;

commit;
