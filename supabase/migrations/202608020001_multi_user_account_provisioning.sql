begin;

-- Public accounts must have an application identity before any owner-scoped
-- data can be created. Keep the existing prototype_users primary key as the
-- application identity so this rollout does not rewrite every foreign key.

-- Deleting an Auth account now removes its application identity. All owned
-- application rows already reference prototype_users with ON DELETE CASCADE,
-- so account deletion is complete instead of leaving an orphaned profile.
-- Existing application identities with auth_user_id IS NULL are preserved.
alter table public.prototype_users
  drop constraint prototype_users_auth_user_id_fkey;

alter table public.prototype_users
  add constraint prototype_users_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete cascade;

comment on column public.prototype_users.auth_user_id is
  'Supabase Auth identity. Deleting the Auth user cascades through this application identity and all user-owned rows.';

-- This is the single provisioning primitive used by both the auth.users
-- trigger and the authenticated recovery RPC below. It is idempotent: the
-- unique auth_user_id constraint chooses one application identity during
-- concurrent calls, while per-user unique constraints choose one copy of each
-- default career mode.
create or replace function public.provision_waypoint_user(
  target_auth_user_id uuid,
  target_email text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_user_id uuid;
  resolved_display_name text;
begin
  if target_auth_user_id is null then
    raise exception 'An auth user id is required.' using errcode = '22004';
  end if;

  -- Prefer identity-provider names, then the email local part. Never copy an
  -- entire metadata object into the public schema.
  resolved_display_name := nullif(btrim(coalesce(
    target_metadata ->> 'full_name',
    target_metadata ->> 'name',
    target_metadata ->> 'preferred_username',
    split_part(coalesce(target_email, ''), '@', 1)
  )), '');
  resolved_display_name := left(coalesce(resolved_display_name, 'Waypoint user'), 120);

  insert into public.prototype_users (auth_user_id, display_name)
  values (target_auth_user_id, resolved_display_name)
  on conflict (auth_user_id) do nothing
  returning id into application_user_id;

  if application_user_id is null then
    select id into strict application_user_id
    from public.prototype_users
    where auth_user_id = target_auth_user_id;
  end if;

  -- These defaults describe search contexts rather than making assumptions
  -- about a new user's profession, location, or acceptable work. Users fill in
  -- targets and constraints during onboarding.
  insert into public.career_modes (
    user_id, slug, name, purpose, display_priority,
    target_role_families, prohibited_role_families, status, confidence,
    source_type, source_ref, last_confirmed_at
  )
  values
    (
      application_user_id,
      'primary-career',
      'Primary career',
      'Evaluate opportunities for your main long-term career direction.',
      1,
      '[]'::jsonb,
      '[]'::jsonb,
      'confirmed',
      1,
      'system_default',
      '{"version":"public-account-v1"}'::jsonb,
      timezone('utc', now())
    ),
    (
      application_user_id,
      'temporary-income',
      'Temporary income',
      'Evaluate short-term income opportunities while protecting progress toward your primary career.',
      2,
      '[]'::jsonb,
      '[]'::jsonb,
      'confirmed',
      1,
      'system_default',
      '{"version":"public-account-v1"}'::jsonb,
      timezone('utc', now())
    )
  on conflict (user_id, slug) do nothing;

  -- Application Kit rows are intentionally not inserted here. Its existing
  -- lazy bootstrap derives useful values from this user's confirmed profile
  -- and latest CV; empty rows created at signup would prevent that bootstrap.

  return application_user_id;
end;
$$;

comment on function public.provision_waypoint_user(uuid, text, jsonb) is
  'Idempotently creates an application identity and neutral career-mode defaults for a Supabase Auth user.';

revoke all on function public.provision_waypoint_user(uuid, text, jsonb) from public;

-- auth.users triggers cannot rely on an end-user session or auth.uid().
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.provision_waypoint_user(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Creates the Waypoint application identity and defaults after an auth.users insert.';

revoke all on function public.handle_new_auth_user() from public;

drop trigger if exists on_auth_user_created_provision_waypoint on auth.users;
create trigger on_auth_user_created_provision_waypoint
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- A narrowly scoped recovery RPC lets a valid session repair an account if a
-- trigger was temporarily unavailable. It cannot provision another user,
-- because it accepts no identity argument and obtains auth.uid() internally.
create or replace function public.bootstrap_current_waypoint_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_auth_user_id uuid := auth.uid();
  caller_email text;
  caller_metadata jsonb;
begin
  if caller_auth_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select email, raw_user_meta_data
  into caller_email, caller_metadata
  from auth.users
  where id = caller_auth_user_id;

  if not found then
    raise exception 'Authenticated user does not exist.' using errcode = '42501';
  end if;

  return public.provision_waypoint_user(
    caller_auth_user_id,
    caller_email,
    coalesce(caller_metadata, '{}'::jsonb)
  );
end;
$$;

comment on function public.bootstrap_current_waypoint_user() is
  'Idempotently repairs the calling authenticated user application identity and defaults.';

revoke all on function public.bootstrap_current_waypoint_user() from public;
grant execute on function public.bootstrap_current_waypoint_user() to authenticated;

-- Backfill every Auth identity that is not already linked. Existing linked
-- identities retain their application id and data; unlinked legacy prototype
-- identities are deliberately not guessed or overwritten.
do $$
declare
  auth_user record;
begin
  for auth_user in
    select id, email, raw_user_meta_data
    from auth.users
    order by created_at, id
  loop
    perform public.provision_waypoint_user(
      auth_user.id,
      auth_user.email,
      coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
    );
  end loop;
end;
$$;

commit;
