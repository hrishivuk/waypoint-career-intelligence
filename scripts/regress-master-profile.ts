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

async function main() {
  const { data: jobs, error } = await client
    .from("jobs")
    .select("id,title,company,description_text,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(2);
  if (error) throw error;
  const comparisons = [];
  for (const job of jobs ?? []) {
    const { data: previous, error: analysisError } = await client
      .from("analyses")
      .select("overall_score,recommendation,summary,completed_at")
      .eq("user_id", userId)
      .eq("job_id", job.id)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (analysisError) throw analysisError;
    const response = await fetch("http://localhost:3000/api/v1/jobs/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: job.description_text,
        force: true,
        reparse: false,
      }),
    });
    const current = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        `Regression analysis failed for ${job.title}: ${JSON.stringify(current)}`,
      );
    }
    comparisons.push({
      job: `${job.company ?? ""} — ${job.title ?? "Untitled"}`,
      before: previous
        ? {
            score: previous.overall_score,
            recommendation: previous.recommendation,
          }
        : null,
      after: {
        score: current.overallScore,
        recommendation: current.recommendation,
        coverage: current.knowledgeCoverage,
        evidenceConfidence: current.evidenceConfidence,
        semanticStatus: current.semanticStatus,
        blockers: Array.isArray(current.blockers)
          ? current.blockers.length
          : null,
        gaps: Array.isArray(current.gaps) ? current.gaps.length : null,
      },
    });
  }
  process.stdout.write(`${JSON.stringify(comparisons, null, 2)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
  process.exitCode = 1;
});
