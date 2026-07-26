import { createClient } from "@supabase/supabase-js";

import { ProjectReviewedHandover } from "../src/application/handover-projection";

async function main() {
  if (!process.argv.includes("--confirm-project")) {
    throw new Error(
      "Projection writes confirmed knowledge. Re-run with --confirm-project after reviewing the staged import.",
    );
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const candidateId =
    process.env.PROTOTYPE_USER_ID ??
    "00000000-0000-4000-8000-000000000001";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const report = await new ProjectReviewedHandover(
    {
      async findReviewedCandidates(ownerId) {
        const run = await client
          .from("handover_import_runs")
          .select("id")
          .eq("user_id", ownerId)
          .eq("status", "staged")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (run.error) throw new Error(run.error.message);
        if (!run.data) return { importRunId: null, candidates: [] };

        const rows = await client
          .from("handover_import_candidates")
          .select(
            "id,import_run_id,stable_record_id,record_type,exact_record,corrected_record,source_order,review_status",
          )
          .eq("user_id", ownerId)
          .eq("import_run_id", run.data.id)
          .in("review_status", ["confirmed", "corrected"])
          .order("source_order", { ascending: true });
        if (rows.error) throw new Error(rows.error.message);
        return {
          importRunId: run.data.id,
          candidates: (rows.data ?? []).map((row) => ({
            stagedCandidateId: row.id,
            importRunId: row.import_run_id,
            stableRecordId: row.stable_record_id,
            recordType: row.record_type,
            reviewStatus: row.review_status as "confirmed" | "corrected",
            sourceOrder: row.source_order,
            exactRecord: row.exact_record as Record<string, unknown>,
            ...(row.corrected_record
              ? {
                  correctedRecord:
                    row.corrected_record as Record<string, unknown>,
                }
              : {}),
          })),
        };
      },
      async projectOne(input) {
        const projected = await client.rpc(
          "project_reviewed_handover_candidate_v1_1",
          {
            p_user_id: input.candidateId,
            p_candidate_id: input.stagedCandidateId,
          },
        );
        if (projected.error) throw new Error(projected.error.message);
        const row = Array.isArray(projected.data)
          ? projected.data[0]
          : projected.data;
        if (
          !row ||
          typeof row !== "object" ||
          !("already_projected" in row)
        ) {
          throw new Error("Projection RPC returned an invalid result.");
        }
        return {
          outcome: row.already_projected
            ? ("already_projected" as const)
            : ("projected" as const),
        };
      },
    },
  ).execute(candidateId);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.failed > 0 || report.blocked > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Projection failed."}\n`,
  );
  process.exitCode = 1;
});
