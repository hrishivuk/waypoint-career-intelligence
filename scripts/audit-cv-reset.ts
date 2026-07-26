import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId =
  process.env.PROTOTYPE_USER_ID ??
  "00000000-0000-4000-8000-000000000001";
if (!url || !key) throw new Error("Supabase is not configured.");
const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function count(table: string) {
  const { count: value, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return value ?? 0;
}

async function main() {
  const [
    cvVersions,
    cvSnapshots,
    cvRuns,
    cvCandidates,
    cvLinks,
    cvDocuments,
    archives,
  ] = await Promise.all([
    count("cv_versions"),
    count("cv_snapshots"),
    count("cv_extraction_runs"),
    count("cv_extraction_candidates"),
    count("cv_knowledge_links"),
    client
      .from("documents")
      .select("id,storage_bucket,storage_path,filename")
      .eq("user_id", userId)
      .eq("kind", "cv"),
    client
      .from("knowledge_rebuild_archives")
      .select("id,pipeline_version,created_at")
      .eq("user_id", userId)
      .order("created_at"),
  ]);
  if (cvDocuments.error) throw cvDocuments.error;
  if (archives.error) throw archives.error;
  process.stdout.write(
    `${JSON.stringify(
      {
        cvVersions,
        cvSnapshots,
        cvRuns,
        cvCandidates,
        cvLinks,
        cvDocuments: cvDocuments.data ?? [],
        knowledgeArchives: archives.data ?? [],
      },
      null,
      2,
    )}\n`,
  );
}

void main().catch((error) => {
  process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
  process.exitCode = 1;
});
