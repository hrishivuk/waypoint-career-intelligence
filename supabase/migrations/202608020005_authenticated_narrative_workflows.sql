begin;

-- These tables already have owner-scoped RLS policies. Restore the minimum
-- authenticated privileges required by the public narrative workflow so
-- ordinary requests do not need the RLS-bypassing service role.
grant select, insert, update, delete
on table public.career_narrative_imports,
         public.career_narrative_candidates
to authenticated;

grant select, update
on table public.master_profile_records
to authenticated;

-- Both activation functions verify owns_prototype_user(p_user_id) for callers
-- that are not service_role, and bind the import/profile mutations to that id.
grant execute on function public.activate_career_narrative_import_v1(uuid, uuid)
to authenticated;
grant execute on function public.activate_career_narrative_import_v2(uuid, uuid)
to authenticated;

-- Retain the projection function as service-role-only, but remove the mutable
-- public schema from its SECURITY DEFINER resolution path.
alter function public.project_skill_model_review(uuid, uuid)
set search_path = '';

commit;
