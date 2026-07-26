begin;

create type public.cv_snapshot_status as enum ('ready', 'partial');

create table public.cv_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  cv_version_id uuid not null,
  source_document_id uuid not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  extracted_text text not null check (length(btrim(extracted_text)) > 0),
  structured_content jsonb not null
    check (
      jsonb_typeof(structured_content) = 'object'
      and jsonb_typeof(structured_content -> 'experiences') = 'array'
      and jsonb_typeof(structured_content -> 'education') = 'array'
      and jsonb_typeof(structured_content -> 'skills') = 'array'
      and jsonb_typeof(structured_content -> 'projects') = 'array'
      and jsonb_typeof(structured_content -> 'certifications') = 'array'
    ),
  status public.cv_snapshot_status not null default 'ready',
  parser_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(parser_metadata) = 'object'),
  model_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(model_metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, cv_version_id),
  unique (id, user_id),
  foreign key (cv_version_id, user_id)
    references public.cv_versions(id, user_id) on delete cascade,
  foreign key (source_document_id, user_id)
    references public.documents(id, user_id) on delete cascade
);

create table public.legacy_cv_knowledge_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

create index cv_snapshots_owner_updated_idx
  on public.cv_snapshots (user_id, updated_at desc);

create trigger cv_snapshots_set_updated_at
before update on public.cv_snapshots
for each row execute function public.set_updated_at();

alter table public.cv_snapshots enable row level security;
alter table public.legacy_cv_knowledge_archives enable row level security;

create policy "owners can access cv snapshots"
on public.cv_snapshots for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can read legacy CV archives"
on public.legacy_cv_knowledge_archives for select to authenticated
using (public.owns_prototype_user(user_id));

insert into public.legacy_cv_knowledge_archives (user_id, snapshot)
select
  owner.id,
  jsonb_build_object(
    'cv_extraction_runs', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.cv_extraction_runs as row_value
      where row_value.user_id = owner.id
    ), '[]'::jsonb),
    'cv_extraction_claims', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.cv_extraction_claims as row_value
      where row_value.user_id = owner.id
    ), '[]'::jsonb),
    'cv_claim_review_events', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.cv_claim_review_events as row_value
      where row_value.user_id = owner.id
    ), '[]'::jsonb),
    'cv_claim_projections', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.projected_at)
      from public.cv_claim_projections as row_value
      where row_value.user_id = owner.id
    ), '[]'::jsonb),
    'cv_skill_records', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.cv_skill_records as row_value
      where row_value.user_id = owner.id
    ), '[]'::jsonb),
    'cv_evidence_records', coalesce((
      select jsonb_agg(to_jsonb(row_value) order by row_value.created_at)
      from public.cv_evidence_records as row_value
      where row_value.user_id = owner.id
    ), '[]'::jsonb),
    'archived_at', timezone('utc', now())
  )
from public.prototype_users as owner
where exists (
  select 1 from public.cv_extraction_runs as run_value
  where run_value.user_id = owner.id
)
on conflict (user_id) do nothing;

-- The old projection workflow is no longer active. Preserve the confirmed
-- global knowledge it produced, but remove CV-to-knowledge links and queues.
update public.knowledge_exceptions
set extraction_run_id = null
where extraction_run_id is not null;

delete from public.cv_claim_review_events;
delete from public.cv_claim_projections;
delete from public.cv_skill_records;
delete from public.cv_evidence_records;
delete from public.cv_extraction_claims;
delete from public.cv_extraction_runs;

create or replace function public.save_cv_snapshot_v1(
  p_user_id uuid,
  p_cv_version_id uuid,
  p_source_document_id uuid,
  p_content_hash text,
  p_extracted_text text,
  p_structured_content jsonb,
  p_status public.cv_snapshot_status,
  p_parser_metadata jsonb,
  p_model_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_id uuid;
  caller_role text := coalesce(auth.role(), 'unknown');
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV snapshot save is not authorised';
  end if;

  if not exists (
    select 1
    from public.cv_versions as version
    where version.id = p_cv_version_id
      and version.user_id = p_user_id
      and version.document_id = p_source_document_id
  ) then
    raise exception 'owned CV version was not found';
  end if;

  insert into public.cv_snapshots (
    user_id, cv_version_id, source_document_id, content_hash,
    extracted_text, structured_content, status, parser_metadata, model_metadata
  ) values (
    p_user_id, p_cv_version_id, p_source_document_id, p_content_hash,
    p_extracted_text, p_structured_content, p_status,
    coalesce(p_parser_metadata, '{}'::jsonb),
    coalesce(p_model_metadata, '{}'::jsonb)
  )
  on conflict (user_id, cv_version_id) do update
  set
    source_document_id = excluded.source_document_id,
    content_hash = excluded.content_hash,
    extracted_text = excluded.extracted_text,
    structured_content = excluded.structured_content,
    status = excluded.status,
    parser_metadata = excluded.parser_metadata,
    model_metadata = excluded.model_metadata
  returning id into snapshot_id;

  update public.documents
  set
    extracted_text = p_extracted_text,
    processing_status = 'completed',
    processing_error = null
  where id = p_source_document_id
    and user_id = p_user_id
    and kind = 'cv';

  return snapshot_id;
end;
$$;

revoke all on table public.cv_snapshots from authenticated;
grant select on table public.cv_snapshots to authenticated;
revoke all on table public.legacy_cv_knowledge_archives from authenticated;
grant select on table public.legacy_cv_knowledge_archives to authenticated;
revoke all on function public.save_cv_snapshot_v1(
  uuid, uuid, uuid, text, text, jsonb, public.cv_snapshot_status, jsonb, jsonb
) from public;
grant execute on function public.save_cv_snapshot_v1(
  uuid, uuid, uuid, text, text, jsonb, public.cv_snapshot_status, jsonb, jsonb
) to service_role;

comment on table public.cv_snapshots is
  'Structured representations of stored CV documents. They never create or modify personal knowledge.';
comment on table public.legacy_cv_knowledge_archives is
  'One-time safety archive of the retired CV-to-knowledge workflow.';

commit;
