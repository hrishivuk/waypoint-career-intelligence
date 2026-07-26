import "server-only";

import type {
  HandoverImportStaging,
  StageProposedHandoverInput,
  StagedHandoverImport,
} from "@/application/handover-import";
import { getSupabaseServerClient } from "../supabase-server";

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

export interface HandoverImportRpcClient {
  rpc(name: string, parameters: Record<string, unknown>): Promise<RpcResult>;
}

interface StagingRow {
  import_run_id: string;
  already_staged: boolean;
  candidate_count: number;
}

export class SupabaseHandoverImportStaging implements HandoverImportStaging {
  constructor(
    private readonly client: HandoverImportRpcClient =
      getSupabaseServerClient() as unknown as HandoverImportRpcClient,
  ) {}

  async stageProposedImport(
    input: StageProposedHandoverInput,
  ): Promise<StagedHandoverImport> {
    assertProposedCandidates(input.candidates);
    if (!/^[0-9a-f]{64}$/.test(input.contentHash)) {
      throw new Error("Handover content hash must be lowercase SHA-256.");
    }

    const { data, error } = await this.client.rpc(
      "stage_handover_import_v1_1",
      {
        p_user_id: input.candidateId,
        p_source_document_id: input.sourceDocumentId,
        p_specification_version: input.specificationVersion,
        p_content_hash: input.contentHash,
        p_candidates: input.candidates,
        p_metadata: input.metadata ?? {},
      },
    );
    if (error) {
      throw new Error(
        `Could not atomically stage handover import: ${error.message ?? "unknown persistence error"}`,
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!isStagingRow(row)) {
      throw new Error("Handover staging returned an invalid result.");
    }
    return {
      importRunId: row.import_run_id,
      alreadyStaged: row.already_staged,
      candidateCount: row.candidate_count,
    };
  }
}

function assertProposedCandidates(
  candidates: ReadonlyArray<Readonly<Record<string, unknown>>>,
): void {
  if (candidates.length === 0) {
    throw new Error("At least one handover candidate is required.");
  }
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (
      candidate.status !== "proposed" ||
      typeof candidate.id !== "string" ||
      typeof candidate.type !== "string"
    ) {
      throw new Error("Every staged handover candidate must be proposed and typed.");
    }
    if (ids.has(candidate.id)) {
      throw new Error(`Duplicate handover candidate ID: ${candidate.id}.`);
    }
    ids.add(candidate.id);
  }
}

function isStagingRow(value: unknown): value is StagingRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.import_run_id === "string" &&
    typeof row.already_staged === "boolean" &&
    typeof row.candidate_count === "number"
  );
}
