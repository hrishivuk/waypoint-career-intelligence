import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HandoverReviewConflictError,
  HandoverReviewNotFoundError,
  type ActiveHandoverReview,
  type HandoverReviewRepository,
  type StagedReviewCandidate,
} from "../../../application/handover-review";

interface ImportRunRow {
  id: string;
  specification_version: string;
  status: string;
  candidate_count: number;
  created_at: string;
}

interface CandidateRow {
  id: string;
  import_run_id: string;
  stable_record_id: string;
  record_type: string;
  exact_record: Record<string, unknown>;
  corrected_record: Record<string, unknown> | null;
  section: string | null;
  source_order: number;
  review_status: "pending" | "confirmed" | "rejected" | "corrected";
  review_revision: number;
  reviewed_at: string | null;
}

interface ReviewRpcResult {
  data: unknown;
  error: { message?: string } | null;
}

export interface HandoverReviewDataClient {
  findActiveRun(candidateId: string): Promise<ImportRunRow | null>;
  findCandidates(candidateId: string, importRunId: string): Promise<CandidateRow[]>;
  findCandidate(candidateId: string, stagedCandidateId: string): Promise<CandidateRow | null>;
  rpc(name: string, parameters: Record<string, unknown>): Promise<ReviewRpcResult>;
}

export class SupabaseHandoverReviewRepository
  implements HandoverReviewRepository
{
  constructor(
    private readonly data: HandoverReviewDataClient,
  ) {}

  async findActive(candidateId: string): Promise<ActiveHandoverReview> {
    const run = await this.data.findActiveRun(candidateId);
    if (!run) return { importRun: null, candidates: [] };
    const candidates = await this.data.findCandidates(candidateId, run.id);
    return {
      importRun: {
        id: run.id,
        specificationVersion: assertV11(run.specification_version),
        status: run.status,
        candidateCount: run.candidate_count,
        createdAt: run.created_at,
      },
      candidates: candidates.map(mapCandidate),
    };
  }

  async reviewOne(
    input: Parameters<HandoverReviewRepository["reviewOne"]>[0],
  ): Promise<StagedReviewCandidate> {
    const decision =
      input.action === "confirm"
        ? "confirmed"
        : input.action === "reject"
          ? "rejected"
          : "corrected";
    const { error } = await this.data.rpc("review_handover_candidate_v1_1", {
      p_user_id: input.candidateId,
      p_candidate_id: input.stagedCandidateId,
      p_expected_revision: input.expectedVersion,
      p_decision: decision,
      p_corrected_record: input.correctedRecord ?? null,
      p_notes: null,
    });
    if (error) {
      const message = error.message ?? "Candidate review failed.";
      if (message.includes("revision conflict")) {
        throw new HandoverReviewConflictError(message);
      }
      if (message.includes("not found")) {
        throw new HandoverReviewNotFoundError(message);
      }
      throw new Error(`Could not review handover candidate: ${message}`);
    }
    const candidate = await this.data.findCandidate(
      input.candidateId,
      input.stagedCandidateId,
    );
    if (!candidate) {
      throw new HandoverReviewNotFoundError(
        "Reviewed handover candidate could not be read.",
      );
    }
    return mapCandidate(candidate);
  }

  async findOne(
    candidateId: string,
    stagedCandidateId: string,
  ): Promise<StagedReviewCandidate | null> {
    const row = await this.data.findCandidate(candidateId, stagedCandidateId);
    return row ? mapCandidate(row) : null;
  }
}

export class SupabaseHandoverReviewDataClient implements HandoverReviewDataClient {
  constructor(private readonly client: SupabaseClient) {}

  async findActiveRun(candidateId: string): Promise<ImportRunRow | null> {
    const { data, error } = await this.client
      .from("handover_import_runs")
      .select("id,specification_version,status,candidate_count,created_at")
      .eq("user_id", candidateId)
      .eq("status", "staged")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Could not list handover review: ${error.message}`);
    return data as ImportRunRow | null;
  }

  async findCandidates(
    candidateId: string,
    importRunId: string,
  ): Promise<CandidateRow[]> {
    const { data, error } = await this.client
      .from("handover_import_candidates")
      .select(CANDIDATE_COLUMNS)
      .eq("user_id", candidateId)
      .eq("import_run_id", importRunId)
      .order("source_order", { ascending: true });
    if (error) throw new Error(`Could not list handover candidates: ${error.message}`);
    return (data ?? []) as CandidateRow[];
  }

  async findCandidate(
    candidateId: string,
    stagedCandidateId: string,
  ): Promise<CandidateRow | null> {
    const { data, error } = await this.client
      .from("handover_import_candidates")
      .select(CANDIDATE_COLUMNS)
      .eq("user_id", candidateId)
      .eq("id", stagedCandidateId)
      .maybeSingle();
    if (error) throw new Error(`Could not read handover candidate: ${error.message}`);
    return data as CandidateRow | null;
  }

  rpc(name: string, parameters: Record<string, unknown>): Promise<ReviewRpcResult> {
    return this.client.rpc(name, parameters) as unknown as Promise<ReviewRpcResult>;
  }
}

const CANDIDATE_COLUMNS =
  "id,import_run_id,stable_record_id,record_type,exact_record,corrected_record,section,source_order,review_status,review_revision,reviewed_at";

function mapCandidate(row: CandidateRow): StagedReviewCandidate {
  return {
    id: row.id,
    importRunId: row.import_run_id,
    stableRecordId: row.stable_record_id,
    recordType: row.record_type,
    exactRecord: row.exact_record,
    ...(row.corrected_record ? { correctedRecord: row.corrected_record } : {}),
    effectiveRecord: row.corrected_record ?? row.exact_record,
    ...(row.section ? { section: row.section } : {}),
    sourceOrder: row.source_order,
    reviewStatus: row.review_status,
    version: row.review_revision,
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
  };
}

function assertV11(value: string): "1.1" {
  if (value !== "1.1") {
    throw new Error(`Unsupported staged handover version: ${value}.`);
  }
  return value;
}
