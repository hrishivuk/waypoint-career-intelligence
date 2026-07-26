begin;

create type public.handover_review_status as enum (
  'pending',
  'confirmed',
  'rejected',
  'corrected'
);

alter table public.handover_import_candidates
  add column review_status public.handover_review_status not null default 'pending',
  add column corrected_record jsonb,
  add column review_notes text,
  add column reviewed_at timestamptz,
  add column reviewed_by_auth_user_id uuid references auth.users(id) on delete set null,
  add column reviewed_by_role text,
  add column review_revision integer not null default 0 check (review_revision >= 0),
  add constraint handover_candidate_review_shape_check check (
    (
      review_status = 'pending'
      and corrected_record is null
      and reviewed_at is null
      and reviewed_by_auth_user_id is null
      and reviewed_by_role is null
    )
    or
    (
      review_status in ('confirmed', 'rejected')
      and corrected_record is null
      and reviewed_at is not null
      and reviewed_by_role is not null
    )
    or
    (
      review_status = 'corrected'
      and corrected_record is not null
      and reviewed_at is not null
      and reviewed_by_role is not null
    )
  ),
  add constraint handover_candidate_corrected_record_check check (
    corrected_record is null
    or (
      jsonb_typeof(corrected_record) = 'object'
      and corrected_record ->> 'id' = stable_record_id
      and corrected_record ->> 'type' = record_type
      and corrected_record ->> 'status' = 'proposed'
    )
  );

create table public.handover_candidate_review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  candidate_id uuid not null,
  from_status public.handover_review_status not null,
  to_status public.handover_review_status not null,
  revision integer not null check (revision > 0),
  corrected_record jsonb,
  notes text,
  reviewed_by_auth_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_role text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (candidate_id, revision),
  foreign key (candidate_id, user_id)
    references public.handover_import_candidates(id, user_id) on delete cascade,
  check (
    (to_status = 'corrected' and corrected_record is not null)
    or (to_status <> 'corrected' and corrected_record is null)
  ),
  check (
    corrected_record is null
    or (
      jsonb_typeof(corrected_record) = 'object'
      and corrected_record ->> 'status' = 'proposed'
    )
  )
);

create index handover_candidates_review_queue_idx
  on public.handover_import_candidates
    (user_id, import_run_id, review_status, source_order);
create index handover_review_events_candidate_idx
  on public.handover_candidate_review_events (candidate_id, revision desc);
create index handover_review_events_owner_created_idx
  on public.handover_candidate_review_events (user_id, created_at desc);

alter table public.handover_candidate_review_events enable row level security;

create policy "owners can read handover review events"
on public.handover_candidate_review_events for select to authenticated
using (public.owns_prototype_user(user_id));

-- Source records and their staging identity are immutable after insertion.
-- Review changes only the dedicated review columns.
create or replace function public.preserve_handover_candidate_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.import_run_id is distinct from old.import_run_id
    or new.record_type is distinct from old.record_type
    or new.stable_record_id is distinct from old.stable_record_id
    or new.exact_record is distinct from old.exact_record
    or new.section is distinct from old.section
    or new.source_order is distinct from old.source_order
    or new.has_prior_versions is distinct from old.has_prior_versions
    or new.status is distinct from old.status
    or new.created_at is distinct from old.created_at
  then
    raise exception 'staged handover source records are immutable';
  end if;
  return new;
end;
$$;

create trigger preserve_handover_candidate_source
before update on public.handover_import_candidates
for each row execute function public.preserve_handover_candidate_source();

-- Authenticated clients review through the auditable RPC. Service-role access
-- remains available to trusted server code and maintenance.
revoke update, delete on public.handover_import_candidates from authenticated;
revoke insert, update, delete on public.handover_candidate_review_events
  from authenticated;

create or replace function public.review_handover_candidate_v1_1(
  p_user_id uuid,
  p_candidate_id uuid,
  p_expected_revision integer,
  p_decision public.handover_review_status,
  p_corrected_record jsonb default null,
  p_notes text default null
)
returns table (
  candidate_id uuid,
  review_status public.handover_review_status,
  review_revision integer,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.handover_import_candidates%rowtype;
  decision_time timestamptz := timezone('utc', now());
  reviewer_id uuid := auth.uid();
  reviewer_role text := coalesce(auth.role(), 'unknown');
begin
  if reviewer_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'candidate review is not authorised';
  end if;
  if p_decision = 'pending' then
    raise exception 'pending is not a review decision';
  end if;
  if p_expected_revision < 0 then
    raise exception 'expected revision must not be negative';
  end if;

  select *
  into candidate
  from public.handover_import_candidates
  where id = p_candidate_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'handover candidate not found';
  end if;
  if candidate.review_revision <> p_expected_revision then
    raise exception 'handover candidate review revision conflict';
  end if;

  if p_decision = 'corrected' then
    if p_corrected_record is null
      or jsonb_typeof(p_corrected_record) <> 'object'
      or p_corrected_record ->> 'id' is distinct from candidate.stable_record_id
      or p_corrected_record ->> 'type' is distinct from candidate.record_type
      or p_corrected_record ->> 'status' is distinct from 'proposed'
    then
      raise exception 'corrected record must preserve id/type and remain proposed';
    end if;
  elsif p_corrected_record is not null then
    raise exception 'corrected record is only valid for a corrected decision';
  end if;

  update public.handover_import_candidates
  set
    review_status = p_decision,
    corrected_record = p_corrected_record,
    review_notes = nullif(btrim(p_notes), ''),
    reviewed_at = decision_time,
    reviewed_by_auth_user_id = reviewer_id,
    reviewed_by_role = reviewer_role,
    review_revision = candidate.review_revision + 1
  where id = candidate.id
    and user_id = candidate.user_id
    and review_revision = p_expected_revision;

  if not found then
    raise exception 'handover candidate review revision conflict';
  end if;

  insert into public.handover_candidate_review_events (
    user_id,
    candidate_id,
    from_status,
    to_status,
    revision,
    corrected_record,
    notes,
    reviewed_by_auth_user_id,
    reviewed_by_role
  )
  values (
    candidate.user_id,
    candidate.id,
    candidate.review_status,
    p_decision,
    candidate.review_revision + 1,
    p_corrected_record,
    nullif(btrim(p_notes), ''),
    reviewer_id,
    reviewer_role
  );

  return query
  select
    candidate.id,
    p_decision,
    candidate.review_revision + 1,
    decision_time;
end;
$$;

revoke all on function public.review_handover_candidate_v1_1(
  uuid, uuid, integer, public.handover_review_status, jsonb, text
) from public;
grant execute on function public.review_handover_candidate_v1_1(
  uuid, uuid, integer, public.handover_review_status, jsonb, text
) to authenticated, service_role;

comment on table public.handover_import_candidates is
  'Immutable proposed v1.1 source candidates plus review state. Confirmation does not project into typed knowledge.';
comment on table public.handover_candidate_review_events is
  'Append-only audit trail for individual candidate review decisions.';
comment on function public.review_handover_candidate_v1_1(
  uuid, uuid, integer, public.handover_review_status, jsonb, text
) is
  'Reviews one proposed candidate with optimistic locking. It never projects or confirms typed knowledge.';

commit;
