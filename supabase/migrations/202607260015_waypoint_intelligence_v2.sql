begin;

create type public.knowledge_exception_status as enum (
  'open',
  'resolved',
  'dismissed'
);

create type public.knowledge_exception_reason as enum (
  'invalid_source',
  'conflict',
  'duplicate',
  'weak_inference',
  'invalid_structure'
);

create type public.job_requirement_criticality as enum (
  'eligibility',
  'mandatory_core',
  'important',
  'preferred',
  'bonus',
  'unclear'
);

create table public.document_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  document_id uuid not null,
  stable_block_id text not null
    check (stable_block_id ~ '^block-[0-9]{4,}$'),
  page_number integer check (page_number is null or page_number > 0),
  section text,
  source_order integer not null check (source_order >= 0),
  exact_text text not null check (length(exact_text) > 0),
  start_character integer not null check (start_character >= 0),
  end_character integer not null check (end_character > start_character),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (document_id, stable_block_id),
  unique (id, user_id),
  foreign key (document_id, user_id)
    references public.documents(id, user_id) on delete cascade
);

create table public.knowledge_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  source_document_id uuid,
  extraction_run_id uuid,
  candidate_key text,
  reason public.knowledge_exception_reason not null,
  status public.knowledge_exception_status not null default 'open',
  candidate jsonb not null check (jsonb_typeof(candidate) = 'object'),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (source_document_id, user_id)
    references public.documents(id, user_id) on delete cascade,
  foreign key (extraction_run_id, user_id)
    references public.cv_extraction_runs(id, user_id) on delete cascade,
  check (
    (status = 'open' and resolved_at is null)
    or (status <> 'open' and resolved_at is not null)
  )
);

create table public.knowledge_rebuild_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  pipeline_version text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create table public.ai_capability_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  capability text not null check (
    capability in (
      'extract_cv_section',
      'canonicalize_skill_candidate',
      'parse_job_section',
      'decompose_requirement',
      'compare_requirement_evidence',
      'generate_explanation'
    )
  ),
  provider text not null,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  status text not null check (status in ('completed', 'failed', 'fallback')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cached_tokens integer check (cached_tokens is null or cached_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  attempt_count integer not null default 1 check (attempt_count between 1 and 3),
  failure_code text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.skills
  add column esco_uri text,
  add column knowledge_context text,
  add column last_used_at date;

alter table public.job_requirements
  add column parent_requirement_id uuid,
  add column criticality public.job_requirement_criticality,
  add column atomic_statement text,
  add column requested_concept text,
  add column requested_context text,
  add column criticality_is_explicit boolean not null default false,
  add column parser_confidence numeric(4,3)
    check (parser_confidence between 0 and 1),
  add constraint job_requirements_parent_fk
    foreign key (parent_requirement_id, user_id)
    references public.job_requirements(id, user_id) on delete cascade;

create index document_blocks_document_order_idx
  on public.document_blocks (user_id, document_id, source_order);
create index knowledge_exceptions_queue_idx
  on public.knowledge_exceptions (user_id, status, created_at desc);
create index ai_capability_runs_owner_created_idx
  on public.ai_capability_runs (user_id, created_at desc);
create index job_requirements_atomic_idx
  on public.job_requirements (user_id, job_id, criticality);

create trigger knowledge_exceptions_set_updated_at
before update on public.knowledge_exceptions
for each row execute function public.set_updated_at();

alter table public.document_blocks enable row level security;
alter table public.knowledge_exceptions enable row level security;
alter table public.knowledge_rebuild_archives enable row level security;
alter table public.ai_capability_runs enable row level security;

create policy "owners can access document blocks"
on public.document_blocks for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access knowledge exceptions"
on public.knowledge_exceptions for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can read rebuild archives"
on public.knowledge_rebuild_archives for select to authenticated
using (public.owns_prototype_user(user_id));

create policy "owners can read AI capability runs"
on public.ai_capability_runs for select to authenticated
using (public.owns_prototype_user(user_id));

create or replace function public.archive_waypoint_knowledge_v1(
  p_user_id uuid,
  p_pipeline_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  archive_id uuid := gen_random_uuid();
  archive_snapshot jsonb;
  archive_hash text;
  requester_role text := coalesce(auth.role(), 'unknown');
begin
  if requester_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'knowledge archive is not authorised';
  end if;

  archive_snapshot := jsonb_build_object(
    'skills', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.skills as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'skill_aliases', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.skill_aliases as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'skill_relationships', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.skill_relationships as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'skill_evidence', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.skill_evidence as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'capability_assessments', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.capability_assessments as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'career_modes', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.career_modes as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'typed_preferences', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.typed_preferences as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'decision_policies', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.decision_policies as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'professional_competencies', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.professional_competencies as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'competency_assessments', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.competency_assessments as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'competency_evidence', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.competency_evidence as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'evidence_records', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.evidence_records as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'analyses', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.analyses as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'cv_skill_records', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.cv_skill_records as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'cv_evidence_records', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.cv_evidence_records as row_value where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'handover_candidate_projections', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.projected_at)
      from public.handover_candidate_projections as row_value
      where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'cv_claim_projections', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.projected_at)
      from public.cv_claim_projections as row_value
      where row_value.user_id = p_user_id
    ), '[]'::jsonb),
    'archived_at', timezone('utc', now())
  );
  archive_hash := encode(
    extensions.digest(convert_to(archive_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );
  insert into public.knowledge_rebuild_archives (
    id, user_id, pipeline_version, snapshot, snapshot_hash
  ) values (
    archive_id, p_user_id, btrim(p_pipeline_version),
    archive_snapshot, archive_hash
  );
  return archive_id;
end;
$$;

create or replace function public.claim_cv_extraction_v2(
  p_user_id uuid,
  p_cv_version_id uuid
)
returns table (
  source_document_id uuid,
  storage_bucket text,
  storage_path text,
  mime_type text,
  filename text
)
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
    raise exception 'CV extraction claim is not authorised';
  end if;

  return query
  update public.documents as document
  set processing_status = 'processing', processing_error = null
  from public.cv_versions as version
  where version.id = p_cv_version_id
    and version.user_id = p_user_id
    and document.id = version.document_id
    and document.user_id = version.user_id
    and document.kind = 'cv'
    and document.processing_status in ('pending', 'failed', 'completed')
  returning document.id, document.storage_bucket, document.storage_path,
    document.mime_type, document.filename;

  if not found then
    if exists (
      select 1
      from public.cv_versions as version
      join public.documents as document
        on document.id = version.document_id
        and document.user_id = version.user_id
      where version.id = p_cv_version_id
        and version.user_id = p_user_id
        and document.processing_status = 'processing'
    ) then
      raise exception 'CV extraction is already running';
    end if;
    raise exception 'owned extractable CV version was not found';
  end if;
end;
$$;

revoke all on table public.knowledge_rebuild_archives from authenticated;
grant select on table public.knowledge_rebuild_archives to authenticated;
revoke all on table public.ai_capability_runs from authenticated;
grant select on table public.ai_capability_runs to authenticated;
revoke all on function public.archive_waypoint_knowledge_v1(uuid, text)
  from public;
grant execute on function public.archive_waypoint_knowledge_v1(uuid, text)
  to service_role;
revoke all on function public.claim_cv_extraction_v2(uuid, uuid) from public;
grant execute on function public.claim_cv_extraction_v2(uuid, uuid)
  to service_role;

comment on table public.document_blocks is
  'Immutable exact source spans. AI cites stable IDs; application code owns excerpts.';
comment on table public.knowledge_rebuild_archives is
  'Immutable pre-rebuild snapshots. Archive creation is service-role only.';
comment on table public.knowledge_exceptions is
  'Quarantine for invalid, conflicting or weak extraction candidates.';

commit;
