begin;

create type public.handover_import_status as enum (
  'staged',
  'reviewed',
  'rejected',
  'projected'
);

create table public.handover_import_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  source_document_id uuid not null,
  specification_version text not null
    check (length(btrim(specification_version)) > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  candidate_set_hash text not null
    check (candidate_set_hash ~ '^[0-9a-f]{64}$'),
  status public.handover_import_status not null default 'staged',
  candidate_count integer not null check (candidate_count > 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, specification_version, content_hash),
  unique (id, user_id),
  foreign key (source_document_id, user_id)
    references public.documents(id, user_id) on delete restrict
);

create table public.handover_import_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  import_run_id uuid not null,
  record_type text not null check (record_type ~ '^[a-z][a-z0-9_]*$'),
  stable_record_id text not null
    check (stable_record_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  exact_record jsonb not null check (jsonb_typeof(exact_record) = 'object'),
  section text,
  source_order integer not null check (source_order >= 0),
  has_prior_versions boolean not null default false,
  status public.knowledge_status not null default 'proposed'
    check (status = 'proposed'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (import_run_id, stable_record_id),
  unique (id, user_id),
  foreign key (import_run_id, user_id)
    references public.handover_import_runs(id, user_id) on delete cascade,
  check (exact_record ->> 'id' = stable_record_id),
  check (exact_record ->> 'type' = record_type),
  check (exact_record ->> 'status' = 'proposed')
);

create index handover_import_runs_user_created_idx
  on public.handover_import_runs (user_id, created_at desc);
create index handover_import_candidates_run_order_idx
  on public.handover_import_candidates (import_run_id, source_order);
create index handover_import_candidates_owner_stable_idx
  on public.handover_import_candidates (user_id, stable_record_id, created_at desc);

create trigger handover_import_runs_set_updated_at
before update on public.handover_import_runs
for each row execute function public.set_updated_at();

alter table public.handover_import_runs enable row level security;
alter table public.handover_import_candidates enable row level security;

create policy "owners can access handover import runs"
on public.handover_import_runs for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access handover import candidates"
on public.handover_import_candidates for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create or replace function public.stage_handover_import_v1_1(
  p_user_id uuid,
  p_source_document_id uuid,
  p_specification_version text,
  p_content_hash text,
  p_candidates jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns table (import_run_id uuid, already_staged boolean, candidate_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  calculated_set_hash text;
  candidate_total integer;
  new_run_id uuid;
  existing_run public.handover_import_runs%rowtype;
begin
  if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) = 0
  then
    raise exception 'candidates must be a non-empty JSON array';
  end if;
  if p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'content_hash must be lowercase SHA-256';
  end if;
  if p_specification_version is distinct from '1.1' then
    raise exception 'stage_handover_import_v1_1 accepts only version 1.1';
  end if;
  if jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'metadata must be a JSON object';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_candidates) candidate
    where jsonb_typeof(candidate) <> 'object'
      or candidate ->> 'status' is distinct from 'proposed'
      or candidate ->> 'id' is null
      or candidate ->> 'id' !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      or candidate ->> 'type' is null
      or candidate ->> 'type' !~ '^[a-z][a-z0-9_]*$'
      or candidate ->> 'type' not in (
        'stable_fact',
        'career_mode',
        'preference',
        'decision_policy',
        'working_style',
        'skill',
        'capability_assessment',
        'evidence',
        'cv_artifact',
        'temporary_state',
        'historical_observation',
        'uncertainty'
      )
  ) then
    raise exception 'every candidate must be a typed, stable-id proposed record';
  end if;
  if (
    select count(*) <> count(distinct candidate ->> 'id')
    from jsonb_array_elements(p_candidates) candidate
  ) then
    raise exception 'candidate stable IDs must be unique within an import';
  end if;

  candidate_total := jsonb_array_length(p_candidates);
  if candidate_total > 500 then
    raise exception 'candidate count exceeds importer limit';
  end if;
  calculated_set_hash := encode(
    extensions.digest(convert_to(p_candidates::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select *
  into existing_run
  from public.handover_import_runs
  where user_id = p_user_id
    and specification_version = p_specification_version
    and content_hash = p_content_hash;

  if found then
    if existing_run.candidate_set_hash <> calculated_set_hash then
      raise exception 'content hash already exists with different candidates';
    end if;
    return query
      select existing_run.id, true, existing_run.candidate_count;
    return;
  end if;

  insert into public.handover_import_runs (
    user_id,
    source_document_id,
    specification_version,
    content_hash,
    candidate_set_hash,
    candidate_count,
    metadata
  )
  values (
    p_user_id,
    p_source_document_id,
    p_specification_version,
    p_content_hash,
    calculated_set_hash,
    candidate_total,
    p_metadata
  )
  returning id into new_run_id;

  insert into public.handover_import_candidates (
    user_id,
    import_run_id,
    record_type,
    stable_record_id,
    exact_record,
    section,
    source_order,
    has_prior_versions
  )
  select
    p_user_id,
    new_run_id,
    candidate ->> 'type',
    candidate ->> 'id',
    candidate,
    nullif(candidate ->> '_section', ''),
    ordinality::integer - 1,
    exists (
      select 1
      from public.handover_import_candidates previous
      where previous.user_id = p_user_id
        and previous.stable_record_id = candidate ->> 'id'
        and previous.exact_record is distinct from candidate
    )
  from jsonb_array_elements(p_candidates) with ordinality
    as incoming(candidate, ordinality);

  return query select new_run_id, false, candidate_total;
exception
  when unique_violation then
    -- A concurrent identical import won the unique-key race. Return it only
    -- when its exact canonical candidate set matches.
    select *
    into existing_run
    from public.handover_import_runs
    where user_id = p_user_id
      and specification_version = p_specification_version
      and content_hash = p_content_hash;
    if not found or existing_run.candidate_set_hash <> calculated_set_hash then
      raise;
    end if;
    return query
      select existing_run.id, true, existing_run.candidate_count;
end;
$$;

revoke all on function public.stage_handover_import_v1_1(
  uuid, uuid, text, text, jsonb, jsonb
) from public;
grant execute on function public.stage_handover_import_v1_1(
  uuid, uuid, text, text, jsonb, jsonb
) to authenticated, service_role;

commit;
