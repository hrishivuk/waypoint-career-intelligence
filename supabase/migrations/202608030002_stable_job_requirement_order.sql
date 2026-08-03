begin;

alter table public.job_requirements
  add column position integer;

with ranked_requirements as (
  select
    id,
    row_number() over (
      partition by user_id, job_id
      order by created_at, id
    ) - 1 as stable_position
  from public.job_requirements
)
update public.job_requirements as requirement
set position = ranked.stable_position
from ranked_requirements as ranked
where requirement.id = ranked.id;

alter table public.job_requirements
  alter column position set not null,
  add constraint job_requirements_position_nonnegative
    check (position >= 0),
  add constraint job_requirements_owner_job_position_unique
    unique (user_id, job_id, position);

comment on column public.job_requirements.position is
  'Zero-based source order of the atomic requirement within its job description.';

commit;
