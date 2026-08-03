begin;

create table public.ai_request_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index ai_request_leases_user_expiry_idx
on public.ai_request_leases(user_id, expires_at);

alter table public.ai_request_leases enable row level security;
revoke all on table public.ai_request_leases from anon, authenticated;
grant select, insert, delete on table public.ai_request_leases to service_role;

create or replace function public.acquire_waypoint_ai_request_lease(
  target_user_id uuid,
  lease_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_concurrency integer;
  active_leases integer;
  acquired_lease_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  if lease_seconds < 15 or lease_seconds > 900 then
    raise exception 'Invalid AI lease duration.' using errcode = '22023';
  end if;

  select concurrent_ai_requests into allowed_concurrency
  from public.user_usage_limits
  where user_id = target_user_id
  for update;
  if allowed_concurrency is null then
    raise exception 'Usage limits not configured.' using errcode = 'P0001';
  end if;

  delete from public.ai_request_leases
  where user_id = target_user_id
    and expires_at <= timezone('utc', now());

  select count(*) into active_leases
  from public.ai_request_leases
  where user_id = target_user_id
    and expires_at > timezone('utc', now());

  if active_leases >= allowed_concurrency then
    raise exception 'AI_CONCURRENCY_LIMIT' using errcode = 'P0001';
  end if;

  insert into public.ai_request_leases (user_id, expires_at)
  values (target_user_id, timezone('utc', now()) + make_interval(secs => lease_seconds))
  returning id into acquired_lease_id;
  return acquired_lease_id;
end;
$$;

create or replace function public.release_waypoint_ai_request_lease(
  target_user_id uuid,
  target_lease_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  delete from public.ai_request_leases
  where id = target_lease_id and user_id = target_user_id;
end;
$$;

revoke all on function public.acquire_waypoint_ai_request_lease(uuid, integer) from public;
revoke all on function public.release_waypoint_ai_request_lease(uuid, uuid) from public;
grant execute on function public.acquire_waypoint_ai_request_lease(uuid, integer) to service_role;
grant execute on function public.release_waypoint_ai_request_lease(uuid, uuid) to service_role;

comment on table public.ai_request_leases is
  'Short-lived per-user leases that enforce concurrent provider-call limits; expired leases are reclaimed during acquisition.';

commit;
