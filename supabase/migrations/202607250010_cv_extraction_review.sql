begin;

create type public.cv_extraction_status as enum (
  'staged',
  'reviewed',
  'failed'
);

create type public.cv_claim_type as enum (
  'experience',
  'education',
  'project',
  'certification',
  'skill'
);

create type public.cv_claim_review_status as enum (
  'pending',
  'confirmed',
  'rejected',
  'corrected'
);

create table public.cv_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  cv_version_id uuid not null,
  source_document_id uuid not null,
  extraction_version text not null check (length(btrim(extraction_version)) > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  candidate_set_hash text not null check (candidate_set_hash ~ '^[0-9a-f]{64}$'),
  extracted_text text not null check (length(extracted_text) > 0),
  status public.cv_extraction_status not null default 'staged',
  candidate_count integer not null check (candidate_count > 0 and candidate_count <= 500),
  parser_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(parser_metadata) = 'object'),
  model_metadata jsonb not null
    check (
      jsonb_typeof(model_metadata) = 'object'
      and length(btrim(coalesce(model_metadata ->> 'model', ''))) > 0
    ),
  failure_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, cv_version_id, extraction_version, content_hash),
  unique (id, user_id),
  foreign key (cv_version_id, user_id)
    references public.cv_versions(id, user_id) on delete cascade,
  foreign key (source_document_id, user_id)
    references public.documents(id, user_id) on delete restrict,
  check (
    (status <> 'failed' and failure_message is null)
    or (status = 'failed' and length(btrim(failure_message)) > 0)
  )
);

create table public.cv_extraction_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  extraction_run_id uuid not null,
  stable_claim_id text not null
    check (stable_claim_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  claim_type public.cv_claim_type not null,
  proposed_record jsonb not null
    check (
      jsonb_typeof(proposed_record) = 'object'
      and proposed_record ->> 'status' = 'proposed'
    ),
  source_spans jsonb not null
    check (jsonb_typeof(source_spans) = 'array' and jsonb_array_length(source_spans) > 0),
  confidence numeric(4,3) check (confidence between 0 and 1),
  source_order integer not null check (source_order >= 0),
  review_status public.cv_claim_review_status not null default 'pending',
  corrected_record jsonb,
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by_auth_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_role text,
  review_revision integer not null default 0 check (review_revision >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (extraction_run_id, stable_claim_id),
  unique (id, user_id),
  foreign key (extraction_run_id, user_id)
    references public.cv_extraction_runs(id, user_id) on delete cascade,
  check (
    (
      review_status = 'pending'
      and corrected_record is null
      and reviewed_at is null
      and reviewed_by_auth_user_id is null
      and reviewed_by_role is null
    )
    or (
      review_status in ('confirmed', 'rejected')
      and corrected_record is null
      and reviewed_at is not null
      and reviewed_by_role is not null
    )
    or (
      review_status = 'corrected'
      and corrected_record is not null
      and reviewed_at is not null
      and reviewed_by_role is not null
    )
  ),
  check (
    corrected_record is null
    or (
      jsonb_typeof(corrected_record) = 'object'
      and corrected_record ->> 'status' = 'proposed'
    )
  )
);

create table public.cv_claim_review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  claim_id uuid not null,
  from_status public.cv_claim_review_status not null,
  to_status public.cv_claim_review_status not null,
  revision integer not null check (revision > 0),
  corrected_record jsonb,
  notes text,
  reviewed_by_auth_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_role text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (claim_id, revision),
  foreign key (claim_id, user_id)
    references public.cv_extraction_claims(id, user_id) on delete cascade,
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

create index cv_extraction_runs_owner_version_idx
  on public.cv_extraction_runs (user_id, cv_version_id, created_at desc);
create index cv_extraction_claims_review_queue_idx
  on public.cv_extraction_claims
    (user_id, extraction_run_id, review_status, source_order);
create index cv_claim_review_events_claim_idx
  on public.cv_claim_review_events (claim_id, revision desc);

create trigger cv_extraction_runs_set_updated_at
before update on public.cv_extraction_runs
for each row execute function public.set_updated_at();

alter table public.cv_extraction_runs enable row level security;
alter table public.cv_extraction_claims enable row level security;
alter table public.cv_claim_review_events enable row level security;

create policy "owners can read cv extraction runs"
on public.cv_extraction_runs for select to authenticated
using (public.owns_prototype_user(user_id));

create policy "owners can read cv extraction claims"
on public.cv_extraction_claims for select to authenticated
using (public.owns_prototype_user(user_id));

create policy "owners can read cv claim review events"
on public.cv_claim_review_events for select to authenticated
using (public.owns_prototype_user(user_id));

create or replace function public.claim_cv_extraction_v1(
  p_user_id uuid,
  p_cv_version_id uuid
)
returns table (
  source_document_id uuid,
  storage_bucket text,
  storage_path text,
  mime_type text,
  filename text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), 'unknown');
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV extraction claim is not authorised';
  end if;

  return query
  update public.documents as document
  set
    processing_status = 'processing',
    processing_error = null
  from public.cv_versions as version
  where version.id = p_cv_version_id
    and version.user_id = p_user_id
    and document.id = version.document_id
    and document.user_id = version.user_id
    and document.kind = 'cv'
    and document.processing_status in ('pending', 'failed')
  returning
    document.id,
    document.storage_bucket,
    document.storage_path,
    document.mime_type,
    document.filename;

  if not found then
    if exists (
      select 1
      from public.cv_versions as version
      join public.documents as document
        on document.id = version.document_id
        and document.user_id = version.user_id
      where version.id = p_cv_version_id
        and version.user_id = p_user_id
        and document.processing_status = 'processing'
    ) then
      raise exception 'CV extraction is already running';
    end if;
    raise exception 'owned extractable CV version was not found';
  end if;
end;
$$;

create or replace function public.fail_cv_extraction_v1(
  p_user_id uuid,
  p_source_document_id uuid,
  p_failure_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), 'unknown');
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV extraction failure update is not authorised';
  end if;
  if nullif(btrim(p_failure_message), '') is null then
    raise exception 'a safe failure message is required';
  end if;

  update public.documents
  set
    processing_status = 'failed',
    processing_error = left(btrim(p_failure_message), 500)
  where id = p_source_document_id
    and user_id = p_user_id
    and kind = 'cv'
    and processing_status = 'processing';
  if not found then
    raise exception 'owned processing CV document was not found';
  end if;
  return p_source_document_id;
end;
$$;

create or replace function public.preserve_cv_extraction_run_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.cv_version_id is distinct from old.cv_version_id
    or new.source_document_id is distinct from old.source_document_id
    or new.extraction_version is distinct from old.extraction_version
    or new.content_hash is distinct from old.content_hash
    or new.candidate_set_hash is distinct from old.candidate_set_hash
    or new.extracted_text is distinct from old.extracted_text
    or new.candidate_count is distinct from old.candidate_count
    or new.parser_metadata is distinct from old.parser_metadata
    or new.model_metadata is distinct from old.model_metadata
    or new.created_at is distinct from old.created_at
  then
    raise exception 'staged CV extraction source and provenance are immutable';
  end if;
  return new;
end;
$$;

create trigger preserve_cv_extraction_run_source
before update on public.cv_extraction_runs
for each row execute function public.preserve_cv_extraction_run_source();

create or replace function public.preserve_cv_extraction_claim_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.extraction_run_id is distinct from old.extraction_run_id
    or new.stable_claim_id is distinct from old.stable_claim_id
    or new.claim_type is distinct from old.claim_type
    or new.proposed_record is distinct from old.proposed_record
    or new.source_spans is distinct from old.source_spans
    or new.confidence is distinct from old.confidence
    or new.source_order is distinct from old.source_order
    or new.created_at is distinct from old.created_at
  then
    raise exception 'staged CV extraction claims are immutable';
  end if;
  return new;
end;
$$;

create trigger preserve_cv_extraction_claim_source
before update on public.cv_extraction_claims
for each row execute function public.preserve_cv_extraction_claim_source();

create or replace function public.stage_cv_extraction_v1(
  p_user_id uuid,
  p_cv_version_id uuid,
  p_source_document_id uuid,
  p_extraction_version text,
  p_content_hash text,
  p_extracted_text text,
  p_candidates jsonb,
  p_parser_metadata jsonb default '{}'::jsonb,
  p_model_metadata jsonb default '{}'::jsonb
)
returns table (
  extraction_run_id uuid,
  already_staged boolean,
  candidate_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), 'unknown');
  calculated_text_hash text;
  calculated_set_hash text;
  candidate_total integer;
  new_run_id uuid;
  existing_run public.cv_extraction_runs%rowtype;
begin
  if caller_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV extraction staging is not authorised';
  end if;
  if nullif(btrim(p_extraction_version), '') is null then
    raise exception 'extraction version is required';
  end if;
  if nullif(p_extracted_text, '') is null then
    raise exception 'extracted text is required';
  end if;
  calculated_text_hash := encode(
    extensions.digest(convert_to(p_extracted_text, 'UTF8'), 'sha256'),
    'hex'
  );
  if p_content_hash is distinct from calculated_text_hash then
    raise exception 'content hash does not match extracted text';
  end if;
  if jsonb_typeof(p_parser_metadata) <> 'object' then
    raise exception 'parser metadata must be an object';
  end if;
  if jsonb_typeof(p_model_metadata) <> 'object'
    or nullif(btrim(p_model_metadata ->> 'model'), '') is null
  then
    raise exception 'model metadata must identify the model';
  end if;
  if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) = 0
  then
    raise exception 'candidates must be a non-empty array';
  end if;
  candidate_total := jsonb_array_length(p_candidates);
  if candidate_total > 500 then
    raise exception 'candidate count exceeds extraction limit';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_candidates) as item(candidate)
    where jsonb_typeof(item.candidate) <> 'object'
      or item.candidate ->> 'id' is null
      or item.candidate ->> 'id' !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      or item.candidate ->> 'type' is null
      or item.candidate ->> 'type' not in (
          'experience', 'education', 'project', 'certification', 'skill'
        )
      or jsonb_typeof(item.candidate -> 'record') <> 'object'
      or item.candidate #>> '{record,status}' is distinct from 'proposed'
      or jsonb_typeof(item.candidate -> 'source_spans') <> 'array'
      or jsonb_array_length(item.candidate -> 'source_spans') = 0
      or (
        item.candidate ? 'confidence'
        and (
          jsonb_typeof(item.candidate -> 'confidence') <> 'number'
          or (item.candidate ->> 'confidence')::numeric not between 0 and 1
        )
      )
  ) then
    raise exception 'every candidate must be a typed proposed record with source spans';
  end if;
  if (
    select count(*) <> count(distinct item.candidate ->> 'id')
    from jsonb_array_elements(p_candidates) as item(candidate)
  ) then
    raise exception 'candidate stable IDs must be unique within an extraction';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_candidates) as item(candidate)
    cross join jsonb_array_elements(item.candidate -> 'source_spans') as located(span)
    where jsonb_typeof(located.span) <> 'object'
      or jsonb_typeof(located.span -> 'start') <> 'number'
      or jsonb_typeof(located.span -> 'end') <> 'number'
      or (located.span ->> 'start')::integer < 0
      or (located.span ->> 'end')::integer <= (located.span ->> 'start')::integer
      or (located.span ->> 'end')::integer > char_length(p_extracted_text)
      or located.span ->> 'excerpt' is distinct from substring(
        p_extracted_text
        from (located.span ->> 'start')::integer + 1
        for (located.span ->> 'end')::integer - (located.span ->> 'start')::integer
      )
  ) then
    raise exception 'source spans must be exact zero-based offsets into extracted text';
  end if;

  perform 1
  from public.cv_versions as version
  join public.documents as document
    on document.id = version.document_id
    and document.user_id = version.user_id
  where version.id = p_cv_version_id
    and version.user_id = p_user_id
    and document.id = p_source_document_id
    and document.kind = 'cv';
  if not found then
    raise exception 'owned CV version and source document were not found';
  end if;

  calculated_set_hash := encode(
    extensions.digest(convert_to(p_candidates::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select run.*
  into existing_run
  from public.cv_extraction_runs as run
  where run.user_id = p_user_id
    and run.cv_version_id = p_cv_version_id
    and run.extraction_version = btrim(p_extraction_version)
    and run.content_hash = p_content_hash;

  if found then
    if existing_run.candidate_set_hash <> calculated_set_hash then
      raise exception 'extraction identity already exists with different candidates';
    end if;
    return query
      select existing_run.id, true, existing_run.candidate_count;
    return;
  end if;

  insert into public.cv_extraction_runs (
    user_id, cv_version_id, source_document_id, extraction_version,
    content_hash, candidate_set_hash, extracted_text, candidate_count,
    parser_metadata, model_metadata
  ) values (
    p_user_id, p_cv_version_id, p_source_document_id, btrim(p_extraction_version),
    p_content_hash, calculated_set_hash, p_extracted_text, candidate_total,
    p_parser_metadata, p_model_metadata
  )
  returning id into new_run_id;

  insert into public.cv_extraction_claims (
    user_id, extraction_run_id, stable_claim_id, claim_type,
    proposed_record, source_spans, confidence, source_order
  )
  select
    p_user_id,
    new_run_id,
    item.candidate ->> 'id',
    (item.candidate ->> 'type')::public.cv_claim_type,
    item.candidate -> 'record',
    item.candidate -> 'source_spans',
    case when item.candidate ? 'confidence'
      then (item.candidate ->> 'confidence')::numeric
      else null
    end,
    item.ordinality::integer - 1
  from jsonb_array_elements(p_candidates) with ordinality
    as item(candidate, ordinality);

  update public.documents as document
  set
    processing_status = 'completed',
    extracted_text = p_extracted_text,
    processing_error = null,
    metadata = document.metadata || jsonb_build_object(
      'cv_extraction_run_id', new_run_id,
      'cv_extraction_version', btrim(p_extraction_version)
    )
  where document.id = p_source_document_id
    and document.user_id = p_user_id;

  return query select new_run_id, false, candidate_total;
exception
  when unique_violation then
    select run.*
    into existing_run
    from public.cv_extraction_runs as run
    where run.user_id = p_user_id
      and run.cv_version_id = p_cv_version_id
      and run.extraction_version = btrim(p_extraction_version)
      and run.content_hash = p_content_hash;
    if not found or existing_run.candidate_set_hash <> calculated_set_hash then
      raise;
    end if;
    return query
      select existing_run.id, true, existing_run.candidate_count;
end;
$$;

create or replace function public.review_cv_extraction_claim_v1(
  p_user_id uuid,
  p_claim_id uuid,
  p_expected_revision integer,
  p_decision public.cv_claim_review_status,
  p_corrected_record jsonb default null,
  p_notes text default null
)
returns table (
  claim_id uuid,
  review_status public.cv_claim_review_status,
  review_revision integer,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  staged public.cv_extraction_claims%rowtype;
  decision_time timestamptz := timezone('utc', now());
  reviewer_id uuid := auth.uid();
  reviewer_role text := coalesce(auth.role(), 'unknown');
begin
  if reviewer_role <> 'service_role'
    and not public.owns_prototype_user(p_user_id)
  then
    raise exception 'CV claim review is not authorised';
  end if;
  if p_decision = 'pending' then
    raise exception 'pending is not a review decision';
  end if;
  if p_expected_revision < 0 then
    raise exception 'expected revision must not be negative';
  end if;

  select claim.*
  into staged
  from public.cv_extraction_claims as claim
  where claim.id = p_claim_id
    and claim.user_id = p_user_id
  for update;

  if not found then
    raise exception 'CV extraction claim not found';
  end if;
  if staged.review_revision <> p_expected_revision then
    raise exception 'CV claim review revision conflict';
  end if;
  if p_decision = 'corrected' then
    if jsonb_typeof(p_corrected_record) <> 'object'
      or p_corrected_record ->> 'status' is distinct from 'proposed'
    then
      raise exception 'corrected record must remain proposed';
    end if;
  elsif p_corrected_record is not null then
    raise exception 'corrected record is only valid for a corrected decision';
  end if;

  update public.cv_extraction_claims as claim
  set
    review_status = p_decision,
    corrected_record = p_corrected_record,
    review_notes = nullif(btrim(p_notes), ''),
    reviewed_at = decision_time,
    reviewed_by_auth_user_id = reviewer_id,
    reviewed_by_role = reviewer_role,
    review_revision = staged.review_revision + 1
  where claim.id = staged.id
    and claim.user_id = staged.user_id
    and claim.review_revision = p_expected_revision;

  if not found then
    raise exception 'CV claim review revision conflict';
  end if;

  insert into public.cv_claim_review_events (
    user_id, claim_id, from_status, to_status, revision, corrected_record,
    notes, reviewed_by_auth_user_id, reviewed_by_role
  ) values (
    staged.user_id, staged.id, staged.review_status, p_decision,
    staged.review_revision + 1, p_corrected_record, nullif(btrim(p_notes), ''),
    reviewer_id, reviewer_role
  );

  update public.cv_extraction_runs as run
  set status = case
    when exists (
      select 1
      from public.cv_extraction_claims as remaining
      where remaining.extraction_run_id = staged.extraction_run_id
        and remaining.review_status = 'pending'
    ) then 'staged'::public.cv_extraction_status
    else 'reviewed'::public.cv_extraction_status
  end
  where run.id = staged.extraction_run_id
    and run.user_id = staged.user_id;

  return query
    select staged.id, p_decision, staged.review_revision + 1, decision_time;
end;
$$;

revoke all on table public.cv_extraction_runs from authenticated;
revoke all on table public.cv_extraction_claims from authenticated;
revoke all on table public.cv_claim_review_events from authenticated;
grant select on table public.cv_extraction_runs to authenticated;
grant select on table public.cv_extraction_claims to authenticated;
grant select on table public.cv_claim_review_events to authenticated;

revoke all on function public.stage_cv_extraction_v1(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
) from public;
revoke all on function public.claim_cv_extraction_v1(uuid, uuid) from public;
revoke all on function public.fail_cv_extraction_v1(uuid, uuid, text) from public;
grant execute on function public.claim_cv_extraction_v1(uuid, uuid)
  to service_role;
grant execute on function public.fail_cv_extraction_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.stage_cv_extraction_v1(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
) to service_role;

revoke all on function public.review_cv_extraction_claim_v1(
  uuid, uuid, integer, public.cv_claim_review_status, jsonb, text
) from public;
grant execute on function public.review_cv_extraction_claim_v1(
  uuid, uuid, integer, public.cv_claim_review_status, jsonb, text
) to authenticated, service_role;

comment on table public.cv_extraction_runs is
  'Versioned CV text extraction and model provenance. Runs stage proposed claims and never project them into personal knowledge.';
comment on table public.cv_extraction_claims is
  'Immutable AI-proposed experience and skill records with exact source spans and separate human review state.';
comment on function public.stage_cv_extraction_v1(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
) is
  'Atomically stages extracted CV text and proposed claims. Service-role only; no knowledge projection.';
comment on function public.review_cv_extraction_claim_v1(
  uuid, uuid, integer, public.cv_claim_review_status, jsonb, text
) is
  'Owner-scoped optimistic review of one CV claim. Even confirmed/corrected records remain proposed until a later explicit projection.';

commit;
