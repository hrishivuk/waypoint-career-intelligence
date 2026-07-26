begin;

-- Waypoint Handover v1.1 refinements. This migration is additive and keeps
-- v1 records readable while allowing the importer to require stricter shapes.

create type public.date_precision as enum ('year', 'month', 'day');
create type public.preference_value_shape as enum ('legacy', 'scalar', 'ordered');
create type public.policy_condition_operator as enum (
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'exists',
  'missing',
  'stale',
  'matches'
);
create type public.policy_effect as enum (
  'block',
  'require_investigation',
  'increase',
  'decrease',
  'prefer',
  'avoid',
  'guidance_only'
);
create type public.knowledge_criticality as enum ('normal', 'important', 'critical');
create type public.staleness_behavior as enum (
  'warn',
  'reduce_confidence',
  'require_review',
  'force_investigate'
);

create domain public.precision_date as jsonb
check (
  jsonb_typeof(value) = 'object'
  and value ? 'value'
  and value ? 'precision'
  and jsonb_typeof(value -> 'value') = 'string'
  and jsonb_typeof(value -> 'precision') = 'string'
  and (
    (value ->> 'precision' = 'year'
      and value ->> 'value' ~ '^[0-9]{4}$')
    or
    (value ->> 'precision' = 'month'
      and value ->> 'value' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    or
    (value ->> 'precision' = 'day'
      and value ->> 'value' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])$'
      and to_char(to_date(value ->> 'value', 'YYYY-MM-DD'), 'YYYY-MM-DD')
        = value ->> 'value')
  )
);

create or replace function public.is_atomic_ordered_preference(input jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  values_array jsonb;
  seen_values text[] := '{}';
begin
  if jsonb_typeof(input) <> 'array'
    or jsonb_array_length(input) < 2
  then
    return false;
  end if;
  values_array := input;
  for item in select value from jsonb_array_elements(values_array)
  loop
    if jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'value') <> 'string'
      or jsonb_typeof(item -> 'rank') <> 'number'
      or (item ->> 'rank')::numeric
        <> coalesce(array_length(seen_values, 1), 0) + 1
      or length(btrim(item ->> 'value')) = 0
      or (item ->> 'value') like '%,%'
      or (item ->> 'value') = any(seen_values)
    then
      return false;
    end if;
    seen_values := array_append(seen_values, item ->> 'value');
  end loop;
  return true;
end;
$$;

-- Source-precision dates are separate from operational timestamps. The old
-- timestamp/date columns remain available for v1 data and runtime scheduling.
alter table public.career_modes
  add column source_start_date public.precision_date,
  add column source_end_date public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn';

alter table public.typed_preferences
  add column value_shape public.preference_value_shape not null default 'legacy',
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn',
  add constraint typed_preferences_v1_1_value_shape_check check (
    value_shape = 'legacy'
    or (
      value_shape = 'scalar'
      and jsonb_typeof(value) = 'string'
      and length(btrim(value #>> '{}')) > 0
      and (value #>> '{}') not like '%,%'
    )
    or (
      value_shape = 'ordered'
      and public.is_atomic_ordered_preference(value)
    )
  );

alter table public.decision_policies
  add column decision_key text,
  add column condition_operator public.policy_condition_operator,
  add column condition_value jsonb,
  add column effect public.policy_effect,
  add column numeric_modifier numeric(7,3),
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn',
  add constraint decision_policies_v1_1_modifier_check check (
    (effect in ('increase', 'decrease')
      and numeric_modifier between -100 and 100)
    or (effect not in ('increase', 'decrease') and numeric_modifier is null)
    or (effect is null and numeric_modifier is null)
  ),
  add constraint decision_policies_v1_1_condition_check check (
    condition_operator is null
    or condition_operator in ('exists', 'missing', 'stale')
    or condition_value is not null
  );

alter table public.evidence_records
  add column source_occurred_from public.precision_date,
  add column source_occurred_until public.precision_date,
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn';

alter table public.skills
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn';

alter table public.capability_assessments
  add column source_assessed_date public.precision_date,
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn';

alter table public.temporary_states
  alter column valid_until drop not null,
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn',
  add constraint temporary_states_v1_1_expiry_or_review_check
    check (
      valid_until is not null
      or review_after is not null
      or source_valid_until is not null
      or source_review_after is not null
    ),
  add constraint temporary_states_v1_1_validity_order_check
    check (valid_until is null or valid_until > valid_from);

alter table public.historical_observations
  add column source_observed_date public.precision_date,
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn';

alter table public.knowledge_uncertainties
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn';

-- Existing profile facts remain the stable-fact store. These additions let
-- eligibility facts participate in v1.1 critical-staleness decisions.
alter table public.career_profile_facts
  add column source_valid_from public.precision_date,
  add column source_valid_until public.precision_date,
  add column source_last_confirmed public.precision_date,
  add column source_review_after public.precision_date,
  add column criticality public.knowledge_criticality not null default 'normal',
  add column stale_behavior public.staleness_behavior not null default 'warn';

create table public.cv_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  stable_id text not null check (stable_id ~ '^[a-z][a-z0-9-]*$'),
  name text not null check (length(btrim(name)) > 0),
  intended_role_families text[] not null default '{}',
  source_document_id uuid,
  cv_version_id uuid,
  revision_identifier text,
  emphasis_summary text,
  supersedes_artifact_id uuid,
  status public.knowledge_status not null default 'proposed',
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_type text not null,
  source_ref jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_ref) = 'object'),
  source_valid_from public.precision_date,
  source_valid_until public.precision_date,
  source_last_confirmed public.precision_date,
  source_review_after public.precision_date,
  last_reviewed_date public.precision_date,
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  review_after timestamptz,
  criticality public.knowledge_criticality not null default 'normal',
  stale_behavior public.staleness_behavior not null default 'warn',
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, stable_id),
  unique (id, user_id),
  foreign key (source_document_id, user_id)
    references public.documents(id, user_id) on delete restrict,
  foreign key (cv_version_id, user_id)
    references public.cv_versions(id, user_id) on delete restrict,
  foreign key (supersedes_artifact_id, user_id)
    references public.cv_artifacts(id, user_id) on delete restrict,
  check (source_document_id is not null or cv_version_id is not null),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (status <> 'confirmed' or last_confirmed_at is not null)
);

-- Structured CV-selection policies reference actual owned artefacts through
-- this junction instead of relying on unvalidated names in prose/JSON.
create table public.decision_policy_cv_artifacts (
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  decision_policy_id uuid not null,
  cv_artifact_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (decision_policy_id, cv_artifact_id),
  foreign key (decision_policy_id, user_id)
    references public.decision_policies(id, user_id) on delete cascade,
  foreign key (cv_artifact_id, user_id)
    references public.cv_artifacts(id, user_id) on delete restrict
);

create index typed_preferences_v1_1_lookup_idx
  on public.typed_preferences (user_id, mode_id, status, value_shape);
create index decision_policies_v1_1_decision_idx
  on public.decision_policies (user_id, mode_id, status, decision_key, priority);
create index temporary_states_v1_1_review_idx
  on public.temporary_states (user_id, status, review_after);
create index cv_artifacts_user_status_idx
  on public.cv_artifacts (user_id, status);
create index cv_artifacts_document_idx
  on public.cv_artifacts (source_document_id);
create index decision_policy_cv_artifacts_artifact_idx
  on public.decision_policy_cv_artifacts (cv_artifact_id);

create trigger cv_artifacts_set_updated_at
before update on public.cv_artifacts
for each row execute function public.set_updated_at();

alter table public.cv_artifacts enable row level security;
alter table public.decision_policy_cv_artifacts enable row level security;

create policy "owners can access cv artifacts" on public.cv_artifacts
for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access policy cv artifacts"
on public.decision_policy_cv_artifacts
for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

commit;
