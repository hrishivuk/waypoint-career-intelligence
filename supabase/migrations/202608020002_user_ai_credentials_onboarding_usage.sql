begin;

-- Only encrypted provider secrets are persisted. Encryption/decryption happens
-- in trusted server code with deployment-managed keys; the database stores an
-- opaque authenticated-encryption envelope and non-secret display metadata.
create table public.user_ai_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'groq')),
  encrypted_secret text not null check (char_length(encrypted_secret) between 32 and 16384),
  key_version text not null check (char_length(btrim(key_version)) between 1 and 100),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{16}$'),
  masked_key text not null check (
    char_length(masked_key) between 8 and 32
    and masked_key !~ '[[:space:]]'
  ),
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, provider)
);

comment on table public.user_ai_provider_credentials is
  'Server-only encrypted BYOK credentials. encrypted_secret is an opaque AES-GCM envelope; plaintext API keys must never be stored.';
comment on column public.user_ai_provider_credentials.fingerprint is
  'Non-secret truncated SHA-256 fingerprint used only to identify replacement or duplicate keys; never use for cache identity.';
comment on column public.user_ai_provider_credentials.masked_key is
  'Non-secret display mask such as eight bullets plus the final four key characters.';

create index user_ai_provider_credentials_user_idx
  on public.user_ai_provider_credentials(user_id);

create trigger user_ai_provider_credentials_set_updated_at
before update on public.user_ai_provider_credentials
for each row execute function public.set_updated_at();

alter table public.user_ai_provider_credentials enable row level security;

create policy user_ai_provider_credentials_owner
on public.user_ai_provider_credentials for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

-- RLS remains a second ownership boundary, but authenticated/anonymous REST
-- clients receive no table privilege at all. Credential routes must use a
-- narrowly held server credential and return only masked metadata.
revoke all on table public.user_ai_provider_credentials from anon, authenticated;
grant select, insert, update, delete on table public.user_ai_provider_credentials to service_role;

create table public.user_onboarding_state (
  user_id uuid primary key references public.prototype_users(id) on delete cascade,
  preferred_ai_provider text check (preferred_ai_provider in ('openai', 'groq')),
  current_step text not null default 'welcome'
    check (char_length(btrim(current_step)) between 1 and 80),
  completed_steps text[] not null default '{}',
  ai_data_processing_accepted_at timestamptz,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (completed_at is null or ai_data_processing_accepted_at is not null)
);

comment on table public.user_onboarding_state is
  'Resumable per-user onboarding progress and timestamped acceptance state.';

create trigger user_onboarding_state_set_updated_at
before update on public.user_onboarding_state
for each row execute function public.set_updated_at();

alter table public.user_onboarding_state enable row level security;
create policy user_onboarding_state_owner
on public.user_onboarding_state for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

revoke all on table public.user_onboarding_state from anon, authenticated;
grant select, insert, update on table public.user_onboarding_state to authenticated;
grant select, insert, update, delete on table public.user_onboarding_state to service_role;

-- Limits are intentionally conservative for the initial public beta. They
-- control Waypoint infrastructure abuse even when the AI bill belongs to the
-- user's provider account.
create table public.user_usage_limits (
  user_id uuid primary key references public.prototype_users(id) on delete cascade,
  ai_requests_per_day integer not null default 25
    check (ai_requests_per_day between 1 and 10000),
  imports_per_day integer not null default 5
    check (imports_per_day between 1 and 1000),
  uploads_per_day integer not null default 10
    check (uploads_per_day between 1 and 1000),
  storage_bytes bigint not null default 104857600
    check (storage_bytes between 1048576 and 1099511627776),
  concurrent_ai_requests integer not null default 2
    check (concurrent_ai_requests between 1 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_usage_daily (
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now()))::date,
  ai_requests integer not null default 0 check (ai_requests >= 0),
  imports integer not null default 0 check (imports >= 0),
  uploads integer not null default 0 check (uploads >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, usage_date)
);

comment on table public.user_usage_limits is
  'Per-user public-beta infrastructure limits. Only trusted server/admin code may change limits.';
comment on table public.user_usage_daily is
  'UTC daily counters maintained atomically by trusted server code.';

create index user_usage_daily_date_idx on public.user_usage_daily(usage_date);

create trigger user_usage_limits_set_updated_at
before update on public.user_usage_limits
for each row execute function public.set_updated_at();
create trigger user_usage_daily_set_updated_at
before update on public.user_usage_daily
for each row execute function public.set_updated_at();

alter table public.user_usage_limits enable row level security;
alter table public.user_usage_daily enable row level security;

create policy user_usage_limits_owner_read
on public.user_usage_limits for select to authenticated
using (public.owns_prototype_user(user_id));
create policy user_usage_daily_owner_read
on public.user_usage_daily for select to authenticated
using (public.owns_prototype_user(user_id));

-- Users may view their allowance and consumption, but counters and limits can
-- only be mutated by trusted server code to prevent quota bypass.
revoke all on table public.user_usage_limits from anon, authenticated;
revoke all on table public.user_usage_daily from anon, authenticated;
grant select on table public.user_usage_limits, public.user_usage_daily to authenticated;
grant select, insert, update, delete on table public.user_usage_limits, public.user_usage_daily to service_role;

-- Seed lifecycle state for every application identity. This helper is used by
-- a prototype_users trigger and is safe to retry during migrations or repairs.
create or replace function public.initialize_waypoint_user_state(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_onboarding_state (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  insert into public.user_usage_limits (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end;
$$;

comment on function public.initialize_waypoint_user_state(uuid) is
  'Idempotently creates onboarding and public-beta usage-limit defaults for an application identity.';
revoke all on function public.initialize_waypoint_user_state(uuid) from public;

create or replace function public.handle_new_waypoint_application_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.initialize_waypoint_user_state(new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_waypoint_application_user() from public;

drop trigger if exists on_waypoint_application_user_created_initialize_state
  on public.prototype_users;
create trigger on_waypoint_application_user_created_initialize_state
after insert on public.prototype_users
for each row execute function public.handle_new_waypoint_application_user();

-- The trigger only handles future rows; seed every existing identity without
-- changing any existing profile, mode, or application data.
select public.initialize_waypoint_user_state(id)
from public.prototype_users;

commit;
