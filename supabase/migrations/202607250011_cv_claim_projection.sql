begin;

create type public.cv_claim_projection_target as enum (
  'skills',
  'evidence_records'
);

create type public.cv_claim_projection_status as enum (
  'projected',
  'reconciled'
);

create table public.cv_claim_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  claim_id uuid not null,
  review_revision integer not null check (review_revision > 0),
  effective_record_hash text not null
    check (effective_record_hash ~ '^[0-9a-f]{64}$'),
  target_table public.cv_claim_projection_target not null,
  target_id uuid not null,
  status public.cv_claim_projection_status not null,
  projected_by_auth_user_id uuid references auth.users(id) on delete set null,
  projected_by_role text not null,
  projected_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  unique (claim_id),
  unique (id, user_id),
  foreign key (claim_id, user_id)
    references public.cv_extraction_claims(id, user_id) on delete restrict
);

create table public.cv_skill_records (
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  cv_version_id uuid not null,
  skill_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (cv_version_id, skill_id),
  foreign key (cv_version_id, user_id)
    references public.cv_versions(id, user_id) on delete cascade,
  foreign key (skill_id, user_id)
    references public.skills(id, user_id) on delete restrict
);

create index cv_claim_projections_owner_created_idx
  on public.cv_claim_projections (user_id, projected_at desc);
create index cv_claim_projections_target_idx
  on public.cv_claim_projections (user_id, target_table, target_id);

alter table public.cv_claim_projections enable row level security;
alter table public.cv_skill_records enable row level security;

create policy "owners can read cv claim projections"
on public.cv_claim_projections for select to authenticated
using (public.owns_prototype_user(user_id));

create policy "owners can access cv skill records"
on public.cv_skill_records for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create or replace function public.project_reviewed_cv_claim_v1(
  p_user_id uuid,
  p_claim_id uuid
)
returns table (
  claim_id uuid,
  target_table public.cv_claim_projection_target,
  target_id uuid,
  already_projected boolean,
  reconciled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  staged public.cv_extraction_claims%rowtype;
  run public.cv_extraction_runs%rowtype;
  existing_projection public.cv_claim_projections%rowtype;
  effective_record jsonb;
  effective_hash text;
  target_uuid uuid;
  projection_target public.cv_claim_projection_target;
  projection_status public.cv_claim_projection_status := 'projected';
  reviewer_id uuid := auth.uid();
  reviewer_role text := coalesce(auth.role(), 'unknown');
  confirmed_time timestamptz := timezone('utc', now());
  evidence_kind_value public.evidence_kind;
  evidence_title text;
  evidence_narrative text;
  evidence_organisation text;
  match_count integer;
  source_reference jsonb;
  attributes_value jsonb;
begin
  if reviewer_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV claim projection is not authorised';
  end if;

  -- Serialise projections for one owner. This also prevents two equivalent
  -- claims from concurrently creating the same deterministic target.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 112947)
  );

  select claim.*
  into staged
  from public.cv_extraction_claims as claim
  where claim.id = p_claim_id
    and claim.user_id = p_user_id
  for update;

  if not found then
    raise exception 'CV extraction claim not found';
  end if;
  if staged.review_status not in ('confirmed', 'corrected') then
    raise exception 'only confirmed or corrected CV claims can be projected';
  end if;

  effective_record := case
    when staged.review_status = 'corrected' then staged.corrected_record
    else staged.proposed_record
  end;
  if jsonb_typeof(effective_record) <> 'object'
    or effective_record ->> 'status' is distinct from 'proposed'
  then
    raise exception 'reviewed CV claim has an invalid effective record';
  end if;

  effective_hash := encode(
    extensions.digest(convert_to(effective_record::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select projection.*
  into existing_projection
  from public.cv_claim_projections as projection
  where projection.claim_id = staged.id
    and projection.user_id = staged.user_id;

  if found then
    if existing_projection.effective_record_hash <> effective_hash
      or existing_projection.review_revision <> staged.review_revision
    then
      raise exception
        'CV claim was already projected from a different reviewed revision';
    end if;
    return query
    select
      staged.id,
      existing_projection.target_table,
      existing_projection.target_id,
      true,
      existing_projection.status = 'reconciled';
    return;
  end if;

  select extraction.*
  into run
  from public.cv_extraction_runs as extraction
  where extraction.id = staged.extraction_run_id
    and extraction.user_id = staged.user_id;
  if not found then
    raise exception 'CV extraction run not found';
  end if;

  source_reference := jsonb_build_object(
    'cv_claim_id', staged.id,
    'stable_claim_id', staged.stable_claim_id,
    'extraction_run_id', staged.extraction_run_id,
    'cv_version_id', run.cv_version_id,
    'source_document_id', run.source_document_id,
    'review_revision', staged.review_revision,
    'review_status', staged.review_status,
    'source_spans', staged.source_spans,
    'effective_record', effective_record
  );

  if staged.claim_type = 'skill' then
    projection_target := 'skills';
    if nullif(btrim(effective_record ->> 'name'), '') is null then
      raise exception 'a projected skill requires a name';
    end if;

    select skill.id
    into target_uuid
    from public.skills as skill
    where skill.user_id = p_user_id
      and lower(btrim(skill.name)) = lower(btrim(effective_record ->> 'name'))
    limit 1;

    if found then
      projection_status := 'reconciled';
      -- The normalized-name constraint makes this the only possible skill
      -- target. The reviewed claim promotes it without overwriting its
      -- original source_ref; this projection ledger carries the CV source.
      update public.skills
      set
        status = 'confirmed',
        last_confirmed_at = confirmed_time
      where id = target_uuid
        and user_id = p_user_id
        and (
          status <> 'confirmed'
          or last_confirmed_at is null
        );
    else
      target_uuid := gen_random_uuid();
      insert into public.skills (
        id, user_id, name, category, status, confidence, source_type,
        source_ref, last_confirmed_at, tags
      ) values (
        target_uuid,
        p_user_id,
        btrim(effective_record ->> 'name'),
        nullif(btrim(effective_record ->> 'category'), ''),
        'confirmed',
        staged.confidence,
        'cv_extraction',
        source_reference,
        confirmed_time,
        array['cv-extracted']
      );
    end if;

    insert into public.cv_skill_records (user_id, cv_version_id, skill_id)
    values (p_user_id, run.cv_version_id, target_uuid)
    on conflict (cv_version_id, skill_id) do nothing;
  else
    projection_target := 'evidence_records';
    evidence_kind_value := case staged.claim_type
      when 'experience' then 'employment'::public.evidence_kind
      when 'education' then 'education'::public.evidence_kind
      when 'project' then 'project'::public.evidence_kind
      when 'certification' then 'achievement'::public.evidence_kind
      else null
    end;
    evidence_title := case staged.claim_type
      when 'experience' then effective_record ->> 'title'
      when 'education' then effective_record ->> 'qualification'
      else effective_record ->> 'name'
    end;
    evidence_organisation := case staged.claim_type
      when 'experience' then effective_record ->> 'employer'
      when 'education' then effective_record ->> 'institution'
      when 'certification' then effective_record ->> 'issuer'
      else null
    end;
    if evidence_kind_value is null
      or nullif(btrim(evidence_title), '') is null
    then
      raise exception 'projected evidence has an unsupported or incomplete shape';
    end if;

    select count(*)
    into match_count
    from public.evidence_records as evidence
    where evidence.user_id = p_user_id
      and evidence.kind = evidence_kind_value
      and evidence.status = 'confirmed'
      and (
        lower(btrim(evidence.title)) = lower(btrim(evidence_title))
        or lower(evidence.title) like '%' || lower(btrim(evidence_title)) || '%'
        or lower(btrim(evidence_title)) like '%' || lower(evidence.title) || '%'
      )
      and lower(btrim(coalesce(evidence.organisation, '')))
        = lower(btrim(coalesce(evidence_organisation, '')));

    if match_count > 1 then
      raise exception 'reviewed CV evidence matches multiple confirmed records';
    elsif match_count = 1 then
      select evidence.id
      into target_uuid
      from public.evidence_records as evidence
      where evidence.user_id = p_user_id
        and evidence.kind = evidence_kind_value
        and evidence.status = 'confirmed'
        and (
          lower(btrim(evidence.title)) = lower(btrim(evidence_title))
          or lower(evidence.title) like '%' || lower(btrim(evidence_title)) || '%'
          or lower(btrim(evidence_title)) like '%' || lower(evidence.title) || '%'
        )
        and lower(btrim(coalesce(evidence.organisation, '')))
          = lower(btrim(coalesce(evidence_organisation, '')));
      projection_status := 'reconciled';
    else
      target_uuid := gen_random_uuid();
      evidence_narrative := case staged.claim_type
        when 'experience' then coalesce(
          nullif((
            select string_agg(item.achievement ->> 'text', E'\n')
            from jsonb_array_elements(
              coalesce(effective_record -> 'achievements', '[]'::jsonb)
            ) as item(achievement)
            where nullif(btrim(item.achievement ->> 'text'), '') is not null
          ), ''),
          evidence_title || ' at ' || coalesce(evidence_organisation, 'unspecified employer')
        )
        when 'education' then concat_ws(
          ' — ',
          evidence_title,
          nullif(btrim(effective_record ->> 'field'), '')
        )
        when 'project' then coalesce(
          nullif(btrim(effective_record ->> 'description'), ''),
          evidence_title
        )
        when 'certification' then concat_ws(
          ' — ',
          evidence_title,
          nullif(btrim(evidence_organisation), '')
        )
      end;
      attributes_value := (effective_record - 'status') || jsonb_build_object(
        'cv_claim_type', staged.claim_type,
        'cv_version_id', run.cv_version_id
      );

      insert into public.evidence_records (
        id, user_id, kind, title, narrative, organisation, attributes,
        status, confidence, source_type, source_ref, last_confirmed_at, tags
      ) values (
        target_uuid,
        p_user_id,
        evidence_kind_value,
        btrim(evidence_title),
        evidence_narrative,
        nullif(btrim(evidence_organisation), ''),
        attributes_value,
        'confirmed',
        staged.confidence,
        'cv_extraction',
        source_reference,
        confirmed_time,
        array['cv-extracted', staged.claim_type::text]
      );
    end if;

    insert into public.cv_evidence_records (
      user_id, cv_version_id, evidence_record_id, section, display_order
    ) values (
      p_user_id,
      run.cv_version_id,
      target_uuid,
      staged.claim_type::text,
      staged.source_order
    )
    on conflict (cv_version_id, evidence_record_id) do update
    set
      section = excluded.section,
      display_order = least(
        coalesce(cv_evidence_records.display_order, excluded.display_order),
        excluded.display_order
      );
  end if;

  insert into public.cv_claim_projections (
    user_id, claim_id, review_revision, effective_record_hash,
    target_table, target_id, status, projected_by_auth_user_id,
    projected_by_role, metadata
  ) values (
    p_user_id,
    staged.id,
    staged.review_revision,
    effective_hash,
    projection_target,
    target_uuid,
    projection_status,
    reviewer_id,
    reviewer_role,
    jsonb_build_object(
      'cv_version_id', run.cv_version_id,
      'source_document_id', run.source_document_id,
      'stable_claim_id', staged.stable_claim_id,
      'source_spans', staged.source_spans
    )
  );

  return query
  select
    staged.id,
    projection_target,
    target_uuid,
    false,
    projection_status = 'reconciled';
end;
$$;

revoke all on table public.cv_claim_projections from authenticated;
revoke all on table public.cv_skill_records from authenticated;
grant select on table public.cv_claim_projections to authenticated;
grant select, insert, update, delete on table public.cv_skill_records
  to authenticated;

revoke all on function public.project_reviewed_cv_claim_v1(uuid, uuid)
  from public;
grant execute on function public.project_reviewed_cv_claim_v1(uuid, uuid)
  to authenticated, service_role;

comment on table public.cv_claim_projections is
  'Immutable idempotency ledger linking each reviewed CV claim revision to one trusted knowledge target.';
comment on function public.project_reviewed_cv_claim_v1(uuid, uuid) is
  'Projects one confirmed/corrected CV claim, or deterministically reconciles it with existing trusted knowledge, while retaining CV provenance.';

commit;
