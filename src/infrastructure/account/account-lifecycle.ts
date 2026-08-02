import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const OWNED_EXPORT_TABLES = [
  "career_modes",
  "career_profile_facts",
  "typed_preferences",
  "skills",
  "professional_competencies",
  "evidence_records",
  "historical_observations",
  "temporary_states",
  "decision_policies",
  "jobs",
  "job_requirements",
  "analyses",
  "mode_aware_analyses",
  "cv_versions",
  "cv_artifacts",
  "cv_documents_v2",
  "career_narrative_imports",
  "career_narrative_candidates",
  "application_kit_sections",
  "application_kit_items",
  "knowledge_exceptions",
  "knowledge_uncertainties",
  "user_onboarding_state",
  "user_usage_limits",
  "user_usage_daily",
] as const;

const DOCUMENT_METADATA_COLUMNS =
  "id,kind,filename,mime_type,byte_size,sha256,processing_status,metadata,created_at,updated_at";

export async function buildAccountExport(
  client: SupabaseClient,
  actor: { userId: string; authUserId: string; email: string | null },
) {
  const profile = await client
    .from("prototype_users")
    .select("id,display_name,created_at,updated_at")
    .eq("id", actor.userId)
    .single();
  if (profile.error) throw profile.error;

  const documents = await client
    .from("documents")
    .select(DOCUMENT_METADATA_COLUMNS)
    .eq("user_id", actor.userId);
  if (documents.error) throw documents.error;

  const records: Record<string, unknown[]> = {};
  for (const table of OWNED_EXPORT_TABLES) {
    const result = await client.from(table).select("*").eq("user_id", actor.userId);
    if (result.error) throw result.error;
    records[table] = table === "cv_documents_v2"
      ? (result.data ?? []).map(withoutStorageLocation)
      : result.data ?? [];
  }
  const cvIds = (records.cv_documents_v2 ?? []).flatMap((row) => {
    if (!row || typeof row !== "object" || !("id" in row)) return [];
    return [String(row.id)];
  });
  for (const table of ["cv_sections_v2", "cv_claims_v2"] as const) {
    if (cvIds.length === 0) {
      records[table] = [];
      continue;
    }
    const result = await client.from(table).select("*").in("cv_document_id", cvIds);
    if (result.error) throw result.error;
    records[table] = result.data ?? [];
  }

  // Provider credentials and internal Storage paths are deliberately omitted.
  return {
    format: "waypoint-account-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: {
      authUserId: actor.authUserId,
      email: actor.email,
      profile: profile.data,
    },
    sourceDocuments: documents.data ?? [],
    records,
  };
}

function withoutStorageLocation(row: Record<string, unknown>) {
  const copy = { ...row };
  delete copy.storage_bucket;
  delete copy.storage_path;
  return copy;
}

export async function deleteAccountData(
  admin: SupabaseClient,
  actor: { userId: string; authUserId: string },
) {
  await removeUserStorage(admin, actor.userId);

  const deleted = await admin
    .from("prototype_users")
    .delete()
    .eq("id", actor.userId)
    .eq("auth_user_id", actor.authUserId);
  if (deleted.error) throw deleted.error;

  const authDeletion = await admin.auth.admin.deleteUser(actor.authUserId);
  if (authDeletion.error) throw authDeletion.error;
}

async function removeUserStorage(admin: SupabaseClient, userId: string) {
  const bucket = admin.storage.from("career-documents");
  const pending = [userId];
  const paths = new Set<string>();

  while (pending.length > 0) {
    const prefix = pending.pop()!;
    for (let offset = 0; ; offset += 100) {
      const listed = await bucket.list(prefix, { limit: 100, offset });
      if (listed.error) throw listed.error;
      const entries = listed.data ?? [];
      for (const entry of entries) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null || entry.metadata === null) pending.push(path);
        else paths.add(path);
      }
      if (entries.length < 100) break;
    }
  }

  const allPaths = [...paths];
  for (let index = 0; index < allPaths.length; index += 100) {
    const removed = await bucket.remove(allPaths.slice(index, index + 100));
    if (removed.error) throw removed.error;
  }
}
