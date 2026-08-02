begin;

create or replace function public.consume_waypoint_daily_usage(
  target_user_id uuid,
  usage_kind text,
  amount integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed integer;
  consumed integer;
  today date := (timezone('utc', now()))::date;
begin
  if amount < 1 or amount > 100 then
    raise exception 'Invalid usage amount.' using errcode = '22023';
  end if;
  if usage_kind not in ('ai_requests', 'imports', 'uploads') then
    raise exception 'Unknown usage kind.' using errcode = '22023';
  end if;

  select case usage_kind
    when 'ai_requests' then ai_requests_per_day
    when 'imports' then imports_per_day
    when 'uploads' then uploads_per_day
  end
  into allowed
  from public.user_usage_limits
  where user_id = target_user_id;
  if allowed is null then
    raise exception 'Usage limits are unavailable.' using errcode = 'P0002';
  end if;

  insert into public.user_usage_daily (user_id, usage_date)
  values (target_user_id, today)
  on conflict (user_id, usage_date) do nothing;

  if usage_kind = 'ai_requests' then
    update public.user_usage_daily set ai_requests = ai_requests + amount
    where user_id = target_user_id and usage_date = today
      and ai_requests + amount <= allowed
    returning ai_requests into consumed;
  elsif usage_kind = 'imports' then
    update public.user_usage_daily set imports = imports + amount
    where user_id = target_user_id and usage_date = today
      and imports + amount <= allowed
    returning imports into consumed;
  else
    update public.user_usage_daily set uploads = uploads + amount
    where user_id = target_user_id and usage_date = today
      and uploads + amount <= allowed
    returning uploads into consumed;
  end if;

  if consumed is null then
    raise exception 'Daily usage limit reached.' using errcode = 'P0001';
  end if;
  return consumed;
end;
$$;

comment on function public.consume_waypoint_daily_usage(uuid, text, integer) is
  'Atomically consumes a public-beta daily allowance. Trusted server use only.';
revoke all on function public.consume_waypoint_daily_usage(uuid, text, integer) from public;
grant execute on function public.consume_waypoint_daily_usage(uuid, text, integer) to service_role;

commit;
