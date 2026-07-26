-- Personal, copy-ready application details. This is user-authored utility data,
-- not evidence used by the matching or scoring pipeline.

create table if not exists public.application_kit_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  section_type text not null check (section_type in ('static', 'reusable', 'generated')),
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, position)
);

create table if not exists public.application_kit_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prototype_users(id) on delete cascade,
  section_id uuid not null references public.application_kit_sections(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 160),
  value text not null default '',
  source_kind text not null default 'manual'
    check (source_kind in ('profile', 'cv', 'manual', 'generated')),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, position)
);

create index if not exists application_kit_sections_user_idx
  on public.application_kit_sections(user_id, position);
create index if not exists application_kit_items_section_idx
  on public.application_kit_items(section_id, position);

alter table public.application_kit_sections enable row level security;
alter table public.application_kit_items enable row level security;

create policy application_kit_sections_owner on public.application_kit_sections
for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

create policy application_kit_items_owner on public.application_kit_items
for all to authenticated
using (public.owns_prototype_user(user_id))
with check (public.owns_prototype_user(user_id));

drop trigger if exists set_application_kit_sections_updated_at on public.application_kit_sections;
create trigger set_application_kit_sections_updated_at
before update on public.application_kit_sections
for each row execute function public.set_updated_at();

drop trigger if exists set_application_kit_items_updated_at on public.application_kit_items;
create trigger set_application_kit_items_updated_at
before update on public.application_kit_items
for each row execute function public.set_updated_at();

