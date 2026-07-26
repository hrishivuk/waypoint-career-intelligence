begin;

create table public.skill_model_review_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  schema_version text not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_name text not null,
  status text not null default 'staged'
    check (status in ('staged', 'reviewed', 'projected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, source_hash),
  unique (id, user_id)
);

create table public.skill_model_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  batch_id uuid not null,
  canonical_name text not null,
  destination text not null
    check (destination in ('skill', 'professional_competency')),
  source_skills text[] not null,
  proposed_level public.capability_proficiency_level,
  corrected_level public.capability_proficiency_level,
  rationale text not null,
  evidence_basis jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_basis) = 'array'),
  assessment_confidence numeric(4,3)
    check (assessment_confidence between 0 and 1),
  blocker_codes text[] not null default '{}',
  review_status text not null default 'pending'
    check (review_status in ('pending', 'confirmed', 'corrected', 'rejected')),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (batch_id, canonical_name, destination),
  unique (id, user_id),
  foreign key (batch_id, user_id)
    references public.skill_model_review_batches(id, user_id) on delete cascade
);

alter table public.skill_model_review_batches enable row level security;
alter table public.skill_model_review_items enable row level security;

create policy "owners can access skill review batches"
on public.skill_model_review_batches for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy "owners can access skill review items"
on public.skill_model_review_items for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

grant select, insert, update, delete on
  public.skill_model_review_batches,
  public.skill_model_review_items
to authenticated;

commit;
