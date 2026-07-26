begin;

-- This migration is intentionally additive. The original profile facts and
-- analyses remain valid while new workflows use the typed, mode-aware model.

alter type public.profile_fact_status rename value 'candidate' to 'proposed';
alter type public.profile_fact_status add value if not exists 'superseded';
alter type public.profile_fact_status add value if not exists 'stale';

create type public.knowledge_status as enum (
  'proposed',
  'confirmed',
  'rejected',
  'superseded',
  'stale'
);
create type public.preference_strength as enum (
  'required',
  'strongly_preferred',
  'preferred',
  'neutral',
  'undesirable',
  'prohibited'
);
create type public.policy_enforcement as enum (
  'hard_rule',
  'score_modifier',
  'model_guidance',
  'mixed'
);
create type public.evidence_kind as enum (
  'employment',
  'project',
  'education',
  'achievement',
  'responsibility',
  'deliverable',
  'outcome',
  'technology',
  'research',
  'design_work'
);
create type public.application_posture as enum (
  'strong_fit',
  'competitive',
  'ambitious',
  'exploratory'
);
create type public.analysis_axis as enum (
  'eligibility',
  'requirements_coverage',
  'evidence_strength',
  'career_direction_alignment',
  'personal_interest',
  'growth_opportunity',
  'application_competitiveness',
  'practical_attractiveness',
  'preference_alignment',
  'uncertainty_and_blockers'
);

create table public.career_modes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z][a-z0-9-]*$'),
  name text not null check (length(btrim(name)) > 0),
  purpose text not null check (length(btrim(purpose)) > 0),
  is_active boolean not null default true,
  display_priority integer not null check (display_priority > 0),
  target_role_families jsonb not null default '[]'::jsonb
    check (jsonb_typeof(target_role_families) = 'array'),
  prohibited_role_families jsonb not null default '[]'::jsonb
    check (jsonb_typeof(prohibited_role_families) = 'array'),
  scoring_policy jsonb not null default '{}'::jsonb
    check (jsonb_typeof(scoring_policy) = 'object'),
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz,
  starts_at timestamptz,
  review_after timestamptz,
  ends_at timestamptz,
  last_confirmed_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, slug),
  unique (user_id, display_priority),
  unique (id, user_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.typed_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  mode_id uuid,
  record_type text not null default 'preference'
    check (record_type in ('preference', 'constraint', 'working_style', 'writing_style')),
  subject text not null check (length(btrim(subject)) > 0),
  value jsonb not null,
  strength public.preference_strength not null default 'neutral',
  reason text,
  exceptions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exceptions) = 'array'),
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (mode_id, user_id) references public.career_modes(id, user_id),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.decision_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  mode_id uuid,
  policy_type text not null check (length(btrim(policy_type)) > 0),
  rule_text text not null check (length(btrim(rule_text)) > 0),
  enforcement public.policy_enforcement not null,
  task_scopes text[] not null default '{}',
  priority integer not null default 100 check (priority >= 0),
  parameters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(parameters) = 'object'),
  exceptions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exceptions) = 'array'),
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (mode_id, user_id) references public.career_modes(id, user_id),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  mode_id uuid,
  parent_evidence_id uuid,
  kind public.evidence_kind not null,
  title text not null check (length(btrim(title)) > 0),
  narrative text not null check (length(btrim(narrative)) > 0),
  organisation text,
  occurred_from date,
  occurred_until date,
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (mode_id, user_id) references public.career_modes(id, user_id),
  foreign key (parent_evidence_id, user_id)
    references public.evidence_records(id, user_id),
  check (occurred_until is null or occurred_from is null or occurred_until >= occurred_from),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  category text,
  description text,
  aliases text[] not null default '{}',
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create unique index skills_user_normalized_name_unique
  on public.skills (user_id, lower(btrim(name)));

create table public.capability_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  skill_id uuid not null,
  mode_id uuid,
  current_level text not null check (length(btrim(current_level)) > 0),
  target_level text,
  context text,
  development_objective text,
  assessed_at timestamptz not null default timezone('utc', now()),
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (skill_id, user_id) references public.skills(id, user_id),
  foreign key (mode_id, user_id) references public.career_modes(id, user_id),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.capability_evidence (
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  capability_assessment_id uuid not null,
  evidence_record_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (capability_assessment_id, evidence_record_id),
  foreign key (capability_assessment_id, user_id)
    references public.capability_assessments(id, user_id) on delete cascade,
  foreign key (evidence_record_id, user_id)
    references public.evidence_records(id, user_id) on delete restrict
);

create table public.temporary_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  mode_id uuid,
  state_type text not null check (length(btrim(state_type)) > 0),
  value jsonb not null,
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz not null default timezone('utc', now()),
  valid_until timestamptz not null,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (mode_id, user_id) references public.career_modes(id, user_id),
  check (valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.historical_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  mode_id uuid,
  observation_type text not null check (length(btrim(observation_type)) > 0),
  observation text not null check (length(btrim(observation)) > 0),
  outcome jsonb not null default '{}'::jsonb
    check (jsonb_typeof(outcome) = 'object'),
  observed_at timestamptz not null,
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (mode_id, user_id) references public.career_modes(id, user_id),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

create table public.knowledge_uncertainties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  mode_id uuid,
  topic text not null check (length(btrim(topic)) > 0),
  description text not null check (length(btrim(description)) > 0),
  resolution_needed text not null check (length(btrim(resolution_needed)) > 0),
  contradicts text[] not null default '{}',
  candidate_values jsonb not null default '[]'::jsonb
    check (jsonb_typeof(candidate_values) = 'array'),
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (mode_id, user_id) references public.career_modes(id, user_id),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

-- One extension row identifies an analysis as using the revised contract.
-- Its non-null mode binding prevents automatic or ambiguous mode selection.
create table public.mode_aware_analyses (
  analysis_id uuid primary key,
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  career_mode_id uuid not null,
  application_posture public.application_posture,
  blockers jsonb not null default '[]'::jsonb check (jsonb_typeof(blockers) = 'array'),
  uncertainties jsonb not null default '[]'::jsonb
    check (jsonb_typeof(uncertainties) = 'array'),
  narrative_tradeoffs text,
  policy_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(policy_snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (analysis_id, user_id),
  foreign key (analysis_id, user_id) references public.analyses(id, user_id) on delete cascade,
  foreign key (career_mode_id, user_id) references public.career_modes(id, user_id)
);

create table public.mode_aware_analysis_axes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  analysis_id uuid not null,
  axis public.analysis_axis not null,
  score numeric(5,2) check (score between 0 and 100),
  confidence numeric(4,3) check (confidence between 0 and 1),
  outcome jsonb not null default '{}'::jsonb check (jsonb_typeof(outcome) = 'object'),
  explanation text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (analysis_id, axis),
  unique (id, user_id),
  foreign key (analysis_id, user_id)
    references public.mode_aware_analyses(analysis_id, user_id) on delete cascade
);

create table public.analysis_evidence_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  analysis_id uuid not null,
  axis_result_id uuid,
  evidence_record_id uuid not null,
  claim text not null check (length(btrim(claim)) > 0),
  source_excerpt text,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (analysis_id, user_id)
    references public.mode_aware_analyses(analysis_id, user_id) on delete cascade,
  foreign key (axis_result_id, user_id)
    references public.mode_aware_analysis_axes(id, user_id) on delete cascade,
  foreign key (evidence_record_id, user_id)
    references public.evidence_records(id, user_id) on delete restrict
);

create table public.cv_evidence_records (
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  cv_version_id uuid not null,
  evidence_record_id uuid not null,
  section text,
  display_order integer check (display_order is null or display_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (cv_version_id, evidence_record_id),
  foreign key (cv_version_id, user_id)
    references public.cv_versions(id, user_id) on delete cascade,
  foreign key (evidence_record_id, user_id)
    references public.evidence_records(id, user_id) on delete restrict
);

create table public.analysis_cv_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  analysis_id uuid not null,
  cv_version_id uuid not null,
  rank integer not null check (rank > 0),
  coverage_score numeric(5,2) check (coverage_score between 0 and 100),
  recommendation_reason text not null,
  tailoring_required boolean not null default false,
  tailoring_guidance jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tailoring_guidance) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (analysis_id, rank),
  unique (analysis_id, cv_version_id),
  foreign key (analysis_id, user_id)
    references public.mode_aware_analyses(analysis_id, user_id) on delete cascade,
  foreign key (cv_version_id, user_id)
    references public.cv_versions(id, user_id) on delete restrict
);

create or replace function public.require_confirmed_analysis_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.evidence_records
    where id = new.evidence_record_id
      and user_id = new.user_id
      and status = 'confirmed'
      and (valid_from is null or valid_from <= timezone('utc', now()))
      and (valid_until is null or valid_until > timezone('utc', now()))
  ) then
    raise exception 'analysis evidence must be confirmed, owned, and currently valid';
  end if;
  return new;
end;
$$;

revoke all on function public.require_confirmed_analysis_evidence() from public;

create index career_modes_user_active_idx on public.career_modes (user_id, is_active);
create index typed_preferences_active_lookup_idx
  on public.typed_preferences (user_id, mode_id, status, subject);
create index decision_policies_task_lookup_idx
  on public.decision_policies using gin (task_scopes);
create index decision_policies_active_lookup_idx
  on public.decision_policies (user_id, mode_id, status, priority);
create index evidence_records_lookup_idx
  on public.evidence_records (user_id, kind, status);
create index evidence_records_tags_idx on public.evidence_records using gin (tags);
create index capability_assessments_skill_idx
  on public.capability_assessments (user_id, skill_id, assessed_at desc);
create index temporary_states_active_lookup_idx
  on public.temporary_states (user_id, mode_id, status, valid_until);
create index historical_observations_lookup_idx
  on public.historical_observations (user_id, mode_id, observed_at desc);
create index knowledge_uncertainties_lookup_idx
  on public.knowledge_uncertainties (user_id, mode_id, status);
create index mode_aware_analyses_mode_idx
  on public.mode_aware_analyses (user_id, career_mode_id, created_at desc);
create index analysis_evidence_links_analysis_idx
  on public.analysis_evidence_links (analysis_id);
create index cv_evidence_records_evidence_idx
  on public.cv_evidence_records (evidence_record_id);

create trigger career_modes_set_updated_at before update on public.career_modes
for each row execute function public.set_updated_at();
create trigger typed_preferences_set_updated_at before update on public.typed_preferences
for each row execute function public.set_updated_at();
create trigger decision_policies_set_updated_at before update on public.decision_policies
for each row execute function public.set_updated_at();
create trigger evidence_records_set_updated_at before update on public.evidence_records
for each row execute function public.set_updated_at();
create trigger skills_set_updated_at before update on public.skills
for each row execute function public.set_updated_at();
create trigger capability_assessments_set_updated_at before update on public.capability_assessments
for each row execute function public.set_updated_at();
create trigger temporary_states_set_updated_at before update on public.temporary_states
for each row execute function public.set_updated_at();
create trigger historical_observations_set_updated_at before update on public.historical_observations
for each row execute function public.set_updated_at();
create trigger knowledge_uncertainties_set_updated_at before update on public.knowledge_uncertainties
for each row execute function public.set_updated_at();
create trigger mode_aware_analyses_set_updated_at before update on public.mode_aware_analyses
for each row execute function public.set_updated_at();
create trigger analysis_evidence_links_require_confirmed
before insert or update on public.analysis_evidence_links
for each row execute function public.require_confirmed_analysis_evidence();

alter table public.career_modes enable row level security;
alter table public.typed_preferences enable row level security;
alter table public.decision_policies enable row level security;
alter table public.evidence_records enable row level security;
alter table public.skills enable row level security;
alter table public.capability_assessments enable row level security;
alter table public.capability_evidence enable row level security;
alter table public.temporary_states enable row level security;
alter table public.historical_observations enable row level security;
alter table public.knowledge_uncertainties enable row level security;
alter table public.mode_aware_analyses enable row level security;
alter table public.mode_aware_analysis_axes enable row level security;
alter table public.analysis_evidence_links enable row level security;
alter table public.cv_evidence_records enable row level security;
alter table public.analysis_cv_candidates enable row level security;

create policy "owners can access career modes" on public.career_modes
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access typed preferences" on public.typed_preferences
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access decision policies" on public.decision_policies
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access evidence records" on public.evidence_records
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access skills" on public.skills
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access capability assessments" on public.capability_assessments
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access capability evidence" on public.capability_evidence
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access temporary states" on public.temporary_states
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access historical observations" on public.historical_observations
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access knowledge uncertainties" on public.knowledge_uncertainties
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access mode aware analyses" on public.mode_aware_analyses
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access mode aware axes" on public.mode_aware_analysis_axes
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access analysis evidence links" on public.analysis_evidence_links
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access cv evidence records" on public.cv_evidence_records
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));
create policy "owners can access analysis cv candidates" on public.analysis_cv_candidates
for all to authenticated using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

-- The project currently has one fixed prototype user. Seed both approved modes
-- for every user present at migration time without assuming or committing its id.
insert into public.career_modes (
  user_id, slug, name, purpose, display_priority,
  target_role_families, prohibited_role_families, status, confidence,
  source_type, source_ref, last_confirmed_at
)
select
  id,
  'primary-career',
  'Primary career',
  'Build a permanent career in frontend engineering, product engineering, UX engineering, product design, UX design, or UI design.',
  1,
  '[
    {"name":"Frontend Engineer","priority":1},
    {"name":"Product Engineer","priority":2},
    {"name":"UX Engineer","priority":3},
    {"name":"Product Designer","priority":4},
    {"name":"UX Designer","priority":5},
    {"name":"UI Designer","priority":6}
  ]'::jsonb,
  '[]'::jsonb,
  'confirmed',
  1,
  'architecture_freeze',
  '{"document":"Freeze Architecture and Continue Waypoint Development"}'::jsonb,
  timezone('utc', now())
from public.prototype_users
on conflict (user_id, slug) do nothing;

insert into public.career_modes (
  user_id, slug, name, purpose, display_priority,
  target_role_families, prohibited_role_families, status, confidence,
  source_type, source_ref, last_confirmed_at
)
select
  id,
  'temporary-income',
  'Temporary income',
  'Find professional office-based income while the primary career search continues.',
  2,
  '[
    {"name":"Trust & Safety"},
    {"name":"Operations"},
    {"name":"Business Support"},
    {"name":"Digital Analyst"},
    {"name":"Technical Support"},
    {"name":"QA"},
    {"name":"Non-sales Customer Success"},
    {"name":"Other professional office or technology-adjacent roles"}
  ]'::jsonb,
  '[
    "Retail","Restaurants","Supermarkets","Shops","Warehouse work",
    "Delivery work","Caretaking","Manual labour"
  ]'::jsonb,
  'confirmed',
  1,
  'architecture_freeze',
  '{"document":"Freeze Architecture and Continue Waypoint Development"}'::jsonb,
  timezone('utc', now())
from public.prototype_users
on conflict (user_id, slug) do nothing;

commit;
