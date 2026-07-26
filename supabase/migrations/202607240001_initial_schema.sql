begin;

create extension if not exists pgcrypto;

create type public.profile_fact_status as enum ('candidate', 'confirmed', 'rejected');
create type public.document_kind as enum ('cv', 'career_handover', 'other');
create type public.processing_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.analysis_recommendation as enum ('apply', 'investigate', 'skip');
create type public.requirement_kind as enum (
  'eligibility',
  'experience',
  'skill',
  'education',
  'responsibility',
  'preference',
  'other'
);
create type public.citation_source_kind as enum ('profile_fact', 'job_requirement', 'document');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.prototype_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.prototype_users is
  'Application identity boundary. The prototype may use a configured id; auth_user_id enables a later Supabase Auth migration.';

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  kind public.document_kind not null,
  filename text not null,
  storage_bucket text not null default 'career-documents',
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  processing_status public.processing_status not null default 'pending',
  extracted_text text,
  processing_error text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, storage_bucket, storage_path)
);

create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  name text not null,
  is_primary boolean not null default false,
  intended_roles text[] not null default '{}',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, document_id)
);

create unique index cv_versions_one_primary_per_user
  on public.cv_versions (user_id) where is_primary;

create table public.career_profile_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  category text not null,
  fact_key text not null,
  value jsonb not null,
  status public.profile_fact_status not null default 'candidate',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_document_id uuid references public.documents(id) on delete set null,
  source_locator jsonb check (source_locator is null or jsonb_typeof(source_locator) = 'object'),
  extraction_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extraction_metadata) = 'object'),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (status = 'candidate' and reviewed_at is null)
    or (status in ('confirmed', 'rejected') and reviewed_at is not null)
  )
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  title text,
  company text,
  source_url text,
  description_text text not null check (length(btrim(description_text)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.job_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind public.requirement_kind not null,
  requirement_text text not null,
  is_required boolean,
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_start integer check (source_start is null or source_start >= 0),
  source_end integer check (source_end is null or source_end >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (source_start is null and source_end is null)
    or (source_start is not null and source_end is not null and source_end > source_start)
  )
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  selected_cv_version_id uuid references public.cv_versions(id) on delete set null,
  recommendation public.analysis_recommendation,
  overall_score numeric(5,2) check (overall_score between 0 and 100),
  confidence numeric(4,3) check (confidence between 0 and 1),
  summary text,
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  status public.processing_status not null default 'pending',
  error_message text,
  model_id text not null,
  prompt_version text not null,
  schema_version text not null,
  scoring_policy_version text not null,
  model_parameters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(model_parameters) = 'object'),
  input_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(input_snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  check (
    (status = 'completed' and completed_at is not null and recommendation is not null)
    or status <> 'completed'
  )
);

create table public.analysis_dimension_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  dimension text not null,
  score numeric(5,2) not null check (score between 0 and 100),
  weight numeric(6,5) not null check (weight between 0 and 1),
  confidence numeric(4,3) check (confidence between 0 and 1),
  explanation text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (analysis_id, dimension)
);

create table public.analysis_evidence_citations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  dimension_score_id uuid references public.analysis_dimension_scores(id) on delete cascade,
  source_kind public.citation_source_kind not null,
  profile_fact_id uuid references public.career_profile_facts(id) on delete restrict,
  job_requirement_id uuid references public.job_requirements(id) on delete restrict,
  document_id uuid references public.documents(id) on delete restrict,
  claim text not null,
  source_excerpt text,
  source_locator jsonb check (source_locator is null or jsonb_typeof(source_locator) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (source_kind = 'profile_fact' and profile_fact_id is not null
      and job_requirement_id is null and document_id is null)
    or
    (source_kind = 'job_requirement' and job_requirement_id is not null
      and profile_fact_id is null and document_id is null)
    or
    (source_kind = 'document' and document_id is not null
      and profile_fact_id is null and job_requirement_id is null)
  )
);

alter table public.documents add constraint documents_id_user_unique unique (id, user_id);
alter table public.cv_versions add constraint cv_versions_id_user_unique unique (id, user_id);
alter table public.career_profile_facts
  add constraint career_profile_facts_id_user_unique unique (id, user_id);
alter table public.jobs add constraint jobs_id_user_unique unique (id, user_id);
alter table public.job_requirements
  add constraint job_requirements_id_user_unique unique (id, user_id);
alter table public.analyses add constraint analyses_id_user_unique unique (id, user_id);
alter table public.analysis_dimension_scores
  add constraint analysis_dimension_scores_id_user_unique unique (id, user_id);

alter table public.cv_versions
  add constraint cv_versions_document_owner_fk
  foreign key (document_id, user_id) references public.documents(id, user_id);
alter table public.career_profile_facts
  add constraint career_profile_facts_source_owner_fk
  foreign key (source_document_id, user_id) references public.documents(id, user_id);
alter table public.job_requirements
  add constraint job_requirements_job_owner_fk
  foreign key (job_id, user_id) references public.jobs(id, user_id);
alter table public.analyses
  add constraint analyses_job_owner_fk
  foreign key (job_id, user_id) references public.jobs(id, user_id);
alter table public.analyses
  add constraint analyses_cv_owner_fk
  foreign key (selected_cv_version_id, user_id) references public.cv_versions(id, user_id);
alter table public.analysis_dimension_scores
  add constraint analysis_dimension_scores_analysis_owner_fk
  foreign key (analysis_id, user_id) references public.analyses(id, user_id);
alter table public.analysis_evidence_citations
  add constraint citations_analysis_owner_fk
  foreign key (analysis_id, user_id) references public.analyses(id, user_id);
alter table public.analysis_evidence_citations
  add constraint citations_dimension_owner_fk
  foreign key (dimension_score_id, user_id)
  references public.analysis_dimension_scores(id, user_id);
alter table public.analysis_evidence_citations
  add constraint citations_profile_fact_owner_fk
  foreign key (profile_fact_id, user_id) references public.career_profile_facts(id, user_id);
alter table public.analysis_evidence_citations
  add constraint citations_requirement_owner_fk
  foreign key (job_requirement_id, user_id) references public.job_requirements(id, user_id);
alter table public.analysis_evidence_citations
  add constraint citations_document_owner_fk
  foreign key (document_id, user_id) references public.documents(id, user_id);

create index documents_user_id_idx on public.documents (user_id);
create index documents_user_kind_idx on public.documents (user_id, kind);
create index cv_versions_user_id_idx on public.cv_versions (user_id);
create index career_profile_facts_user_status_idx
  on public.career_profile_facts (user_id, status);
create index career_profile_facts_user_category_idx
  on public.career_profile_facts (user_id, category);
create index jobs_user_created_idx on public.jobs (user_id, created_at desc);
create index job_requirements_job_id_idx on public.job_requirements (job_id);
create index analyses_user_created_idx on public.analyses (user_id, created_at desc);
create index analyses_job_id_idx on public.analyses (job_id);
create index analysis_dimension_scores_analysis_id_idx
  on public.analysis_dimension_scores (analysis_id);
create index analysis_evidence_citations_analysis_id_idx
  on public.analysis_evidence_citations (analysis_id);

create trigger prototype_users_set_updated_at
before update on public.prototype_users
for each row execute function public.set_updated_at();
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();
create trigger cv_versions_set_updated_at
before update on public.cv_versions
for each row execute function public.set_updated_at();
create trigger career_profile_facts_set_updated_at
before update on public.career_profile_facts
for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();
create trigger analyses_set_updated_at
before update on public.analyses
for each row execute function public.set_updated_at();

create or replace function public.owns_prototype_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.prototype_users
    where id = target_user_id
      and auth_user_id = auth.uid()
  );
$$;

revoke all on function public.owns_prototype_user(uuid) from public;
grant execute on function public.owns_prototype_user(uuid) to authenticated;

create or replace function public.owns_prototype_user_path(path_user_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if path_user_id is null
    or path_user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;
  return public.owns_prototype_user(path_user_id::uuid);
end;
$$;

revoke all on function public.owns_prototype_user_path(text) from public;
grant execute on function public.owns_prototype_user_path(text) to authenticated;

alter table public.prototype_users enable row level security;
alter table public.documents enable row level security;
alter table public.cv_versions enable row level security;
alter table public.career_profile_facts enable row level security;
alter table public.jobs enable row level security;
alter table public.job_requirements enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_dimension_scores enable row level security;
alter table public.analysis_evidence_citations enable row level security;

create policy "users can access their identity"
on public.prototype_users for all to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "owners can access documents"
on public.documents for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access cv versions"
on public.cv_versions for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access profile facts"
on public.career_profile_facts for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access jobs"
on public.jobs for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access requirements"
on public.job_requirements for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access analyses"
on public.analyses for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access dimension scores"
on public.analysis_dimension_scores for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access evidence citations"
on public.analysis_evidence_citations for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

insert into storage.buckets (id, name, public)
values ('career-documents', 'career-documents', false)
on conflict (id) do update set public = excluded.public;

create policy "owners can read career documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'career-documents'
  and public.owns_prototype_user_path((storage.foldername(name))[1])
);
create policy "owners can create career documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'career-documents'
  and public.owns_prototype_user_path((storage.foldername(name))[1])
);
create policy "owners can update career documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'career-documents'
  and public.owns_prototype_user_path((storage.foldername(name))[1])
)
with check (
  bucket_id = 'career-documents'
  and public.owns_prototype_user_path((storage.foldername(name))[1])
);
create policy "owners can delete career documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'career-documents'
  and public.owns_prototype_user_path((storage.foldername(name))[1])
);

commit;
