-- CV System v2: application documents are deliberately separate from profile knowledge.

create table if not exists public.cv_documents_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  original_filename text not null,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_bucket text not null default 'career-documents',
  storage_path text not null,
  intended_roles text[] not null default '{}',
  notes text,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'ready', 'failed')),
  processing_error text,
  extracted_text text,
  page_count integer check (page_count is null or page_count > 0),
  parser_version text not null default 'cv-ats-v2.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sha256)
);

create table if not exists public.cv_sections_v2 (
  id uuid primary key default gen_random_uuid(),
  cv_document_id uuid not null references public.cv_documents_v2(id) on delete cascade,
  section_type text not null check (section_type in (
    'header', 'summary', 'experience', 'education', 'skills',
    'projects', 'certifications', 'other'
  )),
  heading text,
  content text not null,
  position integer not null check (position >= 0),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset >= start_offset),
  unique (cv_document_id, position)
);

create table if not exists public.cv_claims_v2 (
  id uuid primary key default gen_random_uuid(),
  cv_document_id uuid not null references public.cv_documents_v2(id) on delete cascade,
  section_id uuid references public.cv_sections_v2(id) on delete cascade,
  claim_type text not null check (claim_type in (
    'contact', 'summary', 'skill', 'experience', 'education',
    'project', 'certification', 'other'
  )),
  label text not null,
  value text not null,
  source_text text not null,
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset >= start_offset),
  created_at timestamptz not null default now()
);

create index if not exists cv_documents_v2_user_created_idx
  on public.cv_documents_v2(user_id, created_at desc);
create index if not exists cv_sections_v2_document_idx
  on public.cv_sections_v2(cv_document_id, position);
create index if not exists cv_claims_v2_document_idx
  on public.cv_claims_v2(cv_document_id, claim_type);

alter table public.cv_documents_v2 enable row level security;
alter table public.cv_sections_v2 enable row level security;
alter table public.cv_claims_v2 enable row level security;

create policy cv_documents_v2_owner_policy on public.cv_documents_v2
for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy cv_sections_v2_owner_policy on public.cv_sections_v2
for all to authenticated
using (
  exists (
    select 1 from public.cv_documents_v2 d
    where d.id = cv_document_id and public.owns_prototype_user(d.user_id)
  )
)
with check (
  exists (
    select 1 from public.cv_documents_v2 d
    where d.id = cv_document_id and public.owns_prototype_user(d.user_id)
  )
);

create policy cv_claims_v2_owner_policy on public.cv_claims_v2
for all to authenticated
using (
  exists (
    select 1 from public.cv_documents_v2 d
    where d.id = cv_document_id and public.owns_prototype_user(d.user_id)
  )
)
with check (
  exists (
    select 1 from public.cv_documents_v2 d
    where d.id = cv_document_id and public.owns_prototype_user(d.user_id)
  )
);

drop trigger if exists set_cv_documents_v2_updated_at on public.cv_documents_v2;
create trigger set_cv_documents_v2_updated_at
before update on public.cv_documents_v2
for each row execute function public.set_updated_at();

