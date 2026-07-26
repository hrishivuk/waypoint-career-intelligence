begin;

create type public.master_profile_record_type as enum (
  'stable_fact',
  'skill',
  'competency',
  'experience',
  'project',
  'education',
  'achievement',
  'career_direction',
  'preference',
  'eligibility',
  'decision_policy'
);

create type public.narrative_import_status as enum (
  'staged',
  'activated',
  'superseded'
);

create type public.narrative_candidate_decision as enum (
  'pending',
  'confirmed',
  'rejected'
);

create table public.career_narrative_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  source_text text not null check (length(btrim(source_text)) >= 100),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  status public.narrative_import_status not null default 'staged',
  model_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(model_metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  unique (user_id, source_hash),
  unique (id, user_id)
);

create table public.career_narrative_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  import_id uuid not null,
  record_type public.master_profile_record_type not null,
  title text not null check (length(btrim(title)) > 0),
  statement text not null check (length(btrim(statement)) > 0),
  structured_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(structured_data) = 'object'),
  source_block_id text not null check (length(btrim(source_block_id)) > 0),
  source_excerpt text not null check (length(btrim(source_excerpt)) > 0),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  decision public.narrative_candidate_decision not null default 'pending',
  display_order integer not null check (display_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (import_id, display_order),
  unique (id, user_id),
  foreign key (import_id, user_id)
    references public.career_narrative_imports(id, user_id) on delete cascade
);

create table public.master_profile_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  record_type public.master_profile_record_type not null,
  canonical_key text not null check (canonical_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  statement text not null check (length(btrim(statement)) > 0),
  structured_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(structured_data) = 'object'),
  source_import_id uuid not null,
  source_candidate_id uuid not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  status public.knowledge_status not null default 'confirmed',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, record_type, canonical_key),
  unique (id, user_id),
  foreign key (source_import_id, user_id)
    references public.career_narrative_imports(id, user_id) on delete restrict,
  foreign key (source_candidate_id, user_id)
    references public.career_narrative_candidates(id, user_id) on delete restrict
);

create index narrative_candidates_review_idx
  on public.career_narrative_candidates (user_id, import_id, decision, display_order);
create index master_profile_records_type_idx
  on public.master_profile_records (user_id, record_type, status);

create trigger master_profile_records_set_updated_at
before update on public.master_profile_records
for each row execute function public.set_updated_at();

alter table public.career_narrative_imports enable row level security;
alter table public.career_narrative_candidates enable row level security;
alter table public.master_profile_records enable row level security;

create policy "owners can access narrative imports"
on public.career_narrative_imports for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access narrative candidates"
on public.career_narrative_candidates for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access master profile records"
on public.master_profile_records for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create or replace function public.activate_career_narrative_import_v1(
  p_user_id uuid,
  p_import_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  activated_count integer;
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

  insert into public.master_profile_records (
    user_id, record_type, canonical_key, title, statement, structured_data,
    source_import_id, source_candidate_id, confidence, status
  )
  select
    candidate.user_id,
    candidate.record_type,
    left(
      trim(both '-' from regexp_replace(
        lower(candidate.record_type::text || '-' || candidate.title),
        '[^a-z0-9]+', '-', 'g'
      )),
      180
    ),
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
  on conflict (user_id, record_type, canonical_key) do update
  set
    title = excluded.title,
    statement = excluded.statement,
    structured_data = excluded.structured_data,
    source_import_id = excluded.source_import_id,
    source_candidate_id = excluded.source_candidate_id,
    confidence = excluded.confidence,
    status = 'confirmed';

  get diagnostics activated_count = row_count;

  update public.career_narrative_imports
  set status = 'activated', activated_at = timezone('utc', now())
  where id = p_import_id and user_id = p_user_id;

  return activated_count;
end;
$$;

revoke all on table public.career_narrative_imports from authenticated;
grant select on table public.career_narrative_imports to authenticated;
revoke all on table public.career_narrative_candidates from authenticated;
grant select on table public.career_narrative_candidates to authenticated;
revoke all on table public.master_profile_records from authenticated;
grant select on table public.master_profile_records to authenticated;
revoke all on function public.activate_career_narrative_import_v1(uuid, uuid)
  from public;
grant execute on function public.activate_career_narrative_import_v1(uuid, uuid)
  to service_role;

commit;
