import "server-only";

import type {
  HandoverProjectionRepository,
  ProjectionCandidate,
  ProjectionWriteResult,
} from "../../../application/handover-projection";
import { getSupabaseServerClient } from "../supabase-server";

interface ImportRunRow {
  id: string;
}

interface CandidateRow {
  id: string;
  import_run_id: string;
  stable_record_id: string;
  record_type: string;
  exact_record: Record<string, unknown>;
  corrected_record: Record<string, unknown> | null;
  source_order: number;
  review_status: "confirmed" | "corrected";
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

export interface HandoverProjectionDataClient {
  findActiveRun(candidateId: string): Promise<ImportRunRow | null>;
  findReviewedCandidates(
    candidateId: string,
    importRunId: string,
  ): Promise<CandidateRow[]>;
  rpc(name: string, parameters: Record<string, unknown>): Promise<RpcResult>;
}

export class SupabaseHandoverProjectionRepository
  implements HandoverProjectionRepository
{
  constructor(
    private readonly data: HandoverProjectionDataClient =
      new SupabaseHandoverProjectionDataClient(),
  ) {}

  async findReviewedCandidates(candidateId: string): Promise<{
    importRunId: string | null;
    candidates: ProjectionCandidate[];
  }> {
    const run = await this.data.findActiveRun(candidateId);
    if (!run) return { importRunId: null, candidates: [] };
    const rows = await this.data.findReviewedCandidates(candidateId, run.id);
    return {
      importRunId: run.id,
      candidates: rows.map((row) => ({
        stagedCandidateId: row.id,
        importRunId: row.import_run_id,
        stableRecordId: row.stable_record_id,
        recordType: row.record_type,
        reviewStatus: row.review_status,
        sourceOrder: row.source_order,
        exactRecord: row.exact_record,
        ...(row.corrected_record
          ? { correctedRecord: row.corrected_record }
          : {}),
      })),
    };
  }

  async projectOne(input: {
    candidateId: string;
    stagedCandidateId: string;
  }): Promise<ProjectionWriteResult> {
    const { data, error } = await this.data.rpc(
      "project_reviewed_handover_candidate_v1_1",
      {
        p_user_id: input.candidateId,
        p_candidate_id: input.stagedCandidateId,
      },
    );
    if (error) {
      throw new Error(
        `Could not project reviewed handover candidate: ${error.message ?? "unknown persistence error"}`,
      );
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!isProjectionRow(row)) {
      throw new Error("Handover projection returned an invalid result.");
    }
    return {
      outcome: row.already_projected ? "already_projected" : "projected",
    };
  }
}

class SupabaseHandoverProjectionDataClient
  implements HandoverProjectionDataClient
{
  private get client() {
    return getSupabaseServerClient();
  }

  async findActiveRun(candidateId: string): Promise<ImportRunRow | null> {
    const { data, error } = await this.client
      .from("handover_import_runs")
      .select("id")
      .eq("user_id", candidateId)
      .eq("status", "staged")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Could not find staged handover: ${error.message}`);
    return data as ImportRunRow | null;
  }

  async findReviewedCandidates(
    candidateId: string,
    importRunId: string,
  ): Promise<CandidateRow[]> {
    const { data, error } = await this.client
      .from("handover_import_candidates")
      .select(
        "id,import_run_id,stable_record_id,record_type,exact_record,corrected_record,source_order,review_status",
      )
      .eq("user_id", candidateId)
      .eq("import_run_id", importRunId)
      .in("review_status", ["confirmed", "corrected"])
      .order("source_order", { ascending: true });
    if (error) {
      throw new Error(`Could not find reviewed candidates: ${error.message}`);
    }
    return (data ?? []) as CandidateRow[];
  }

  rpc(name: string, parameters: Record<string, unknown>): Promise<RpcResult> {
    return this.client.rpc(name, parameters) as unknown as Promise<RpcResult>;
  }
}

function isProjectionRow(value: unknown): value is {
  candidate_id: string;
  target_table: string;
  target_id: string;
  already_projected: boolean;
} {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.candidate_id === "string" &&
    typeof row.target_table === "string" &&
    typeof row.target_id === "string" &&
    typeof row.already_projected === "boolean"
  );
}
