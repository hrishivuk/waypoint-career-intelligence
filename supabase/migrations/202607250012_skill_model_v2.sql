begin;

create type public.skill_category_code as enum (
  'programming_language',
  'framework',
  'library',
  'tool',
  'platform',
  'database',
  'cloud_service',
  'design_tool',
  'ux_method',
  'design_skill',
  'technical_skill',
  'architecture',
  'methodology',
  'domain_knowledge'
);

create type public.skill_relationship_type as enum (
  'parent_of',
  'related_to',
  'uses',
  'supersedes',
  'alias_of'
);

create type public.capability_proficiency_level as enum (
  'learning',
  'basic',
  'working',
  'strong',
  'expert'
);

create type public.competency_category_code as enum (
  'communication',
  'collaboration',
  'problem_solving',
  'delivery',
  'stakeholder_management',
  'leadership',
  'learning',
  'organisation',
  'product_thinking',
  'other'
);

alter table public.skills
  add column canonical_slug text,
  add column primary_category public.skill_category_code,
  add column taxonomy_version text,
  add column superseded_by_skill_id uuid,
  add constraint skills_canonical_slug_shape
    check (
      canonical_slug is null
      or canonical_slug ~ '^[a-z][a-z0-9-]*$'
    ),
  add constraint skills_superseded_owner_fk
    foreign key (superseded_by_skill_id, user_id)
    references public.skills(id, user_id) on delete restrict;

create unique index skills_owner_canonical_slug_unique
  on public.skills (user_id, canonical_slug)
  where canonical_slug is not null;

create table public.skill_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  skill_id uuid not null,
  alias text not null check (length(btrim(alias)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (skill_id, user_id)
    references public.skills(id, user_id) on delete cascade
);

create unique index skill_aliases_owner_normalized_alias_unique
  on public.skill_aliases (user_id, lower(btrim(alias)));

create table public.skill_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  source_skill_id uuid not null,
  target_skill_id uuid not null,
  relationship public.skill_relationship_type not null,
  status public.knowledge_status not null default 'proposed',
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_skill_id, target_skill_id, relationship),
  foreign key (source_skill_id, user_id)
    references public.skills(id, user_id) on delete cascade,
  foreign key (target_skill_id, user_id)
    references public.skills(id, user_id) on delete cascade,
  check (source_skill_id <> target_skill_id)
);

create table public.skill_evidence (
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  skill_id uuid not null,
  evidence_record_id uuid not null,
  evidence_role text not null default 'supports'
    check (evidence_role in ('supports', 'demonstrates', 'contradicts')),
  strength numeric(4,3) check (strength between 0 and 1),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (skill_id, evidence_record_id, evidence_role),
  foreign key (skill_id, user_id)
    references public.skills(id, user_id) on delete cascade,
  foreign key (evidence_record_id, user_id)
    references public.evidence_records(id, user_id) on delete restrict
);

alter table public.capability_assessments
  add column proficiency_level public.capability_proficiency_level,
  add column assessment_basis text,
  add column assessment_confidence numeric(4,3)
    check (assessment_confidence between 0 and 1),
  add column is_self_assessed boolean not null default false;

update public.capability_assessments
set proficiency_level = current_level::public.capability_proficiency_level
where current_level in ('learning', 'basic', 'working', 'strong', 'expert');

create table public.skill_assessment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  capability_assessment_id uuid not null,
  skill_id uuid not null,
  proficiency_level public.capability_proficiency_level not null,
  assessment_confidence numeric(4,3)
    check (assessment_confidence between 0 and 1),
  context text,
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  confirmed_by_user boolean not null default false,
  assessed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (capability_assessment_id, user_id)
    references public.capability_assessments(id, user_id) on delete cascade,
  foreign key (skill_id, user_id)
    references public.skills(id, user_id) on delete cascade
);

create table public.professional_competencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  canonical_slug text not null check (canonical_slug ~ '^[a-z][a-z0-9-]*$'),
  name text not null check (length(btrim(name)) > 0),
  category public.competency_category_code not null,
  description text,
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, canonical_slug),
  unique (id, user_id),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.competency_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  competency_id uuid not null,
  proficiency_level public.capability_proficiency_level not null,
  context text,
  assessment_confidence numeric(4,3)
    check (assessment_confidence between 0 and 1),
  is_self_assessed boolean not null default false,
  status public.knowledge_status not null default 'proposed',
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  assessed_at timestamptz not null default timezone('utc', now()),
  last_confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (competency_id, user_id)
    references public.professional_competencies(id, user_id) on delete cascade,
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.competency_evidence (
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  competency_assessment_id uuid not null,
  evidence_record_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (competency_assessment_id, evidence_record_id),
  foreign key (competency_assessment_id, user_id)
    references public.competency_assessments(id, user_id) on delete cascade,
  foreign key (evidence_record_id, user_id)
    references public.evidence_records(id, user_id) on delete restrict
);

create unique index capability_assessments_one_confirmed_per_skill
  on public.capability_assessments (user_id, skill_id)
  where status = 'confirmed';

create unique index competency_assessments_one_confirmed_per_competency
  on public.competency_assessments (user_id, competency_id)
  where status = 'confirmed';

alter table public.skill_aliases enable row level security;
alter table public.skill_relationships enable row level security;
alter table public.skill_evidence enable row level security;
alter table public.skill_assessment_events enable row level security;
alter table public.professional_competencies enable row level security;
alter table public.competency_assessments enable row level security;
alter table public.competency_evidence enable row level security;

create policy "owners can access skill aliases"
on public.skill_aliases for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access skill relationships"
on public.skill_relationships for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access skill evidence"
on public.skill_evidence for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access skill assessment events"
on public.skill_assessment_events for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access professional competencies"
on public.professional_competencies for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access competency assessments"
on public.competency_assessments for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access competency evidence"
on public.competency_evidence for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

grant select, insert, update, delete on
  public.skill_aliases,
  public.skill_relationships,
  public.skill_evidence,
  public.skill_assessment_events,
  public.professional_competencies,
  public.competency_assessments,
  public.competency_evidence
to authenticated;

commit;
