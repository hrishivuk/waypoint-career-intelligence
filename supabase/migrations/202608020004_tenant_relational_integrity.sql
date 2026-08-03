begin;

-- A child record must never be attachable to another owner's section merely
-- by guessing its UUID. Include user_id in the relationship so PostgreSQL,
-- not route discipline, enforces the tenant boundary.
alter table public.application_kit_sections
  add constraint application_kit_sections_id_user_unique unique (id, user_id);

alter table public.application_kit_items
  drop constraint if exists application_kit_items_section_id_fkey;

alter table public.application_kit_items
  add constraint application_kit_items_section_owner_fkey
  foreign key (section_id, user_id)
  references public.application_kit_sections(id, user_id)
  on delete cascade;

-- A claim's optional section must belong to the same CV document as the
-- claim. This prevents cross-document and therefore cross-tenant references.
alter table public.cv_sections_v2
  add constraint cv_sections_v2_id_document_unique
  unique (id, cv_document_id);

alter table public.cv_claims_v2
  drop constraint if exists cv_claims_v2_section_id_fkey;

alter table public.cv_claims_v2
  add constraint cv_claims_v2_section_document_fkey
  foreign key (section_id, cv_document_id)
  references public.cv_sections_v2(id, cv_document_id)
  on delete cascade;

-- Authentication provisioning owns identity creation/deletion. End users may
-- read their identity and change only the display name; they cannot directly
-- delete the application identity while leaving auth.users alive, or rebind
-- it to another Auth user.
drop policy if exists "users can access their identity" on public.prototype_users;

create policy prototype_users_owner_read
on public.prototype_users for select to authenticated
using (auth_user_id = (select auth.uid()));

create policy prototype_users_owner_display_update
on public.prototype_users for update to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

revoke insert, delete, update on table public.prototype_users from authenticated;
grant select on table public.prototype_users to authenticated;
grant update (display_name) on table public.prototype_users to authenticated;

commit;
