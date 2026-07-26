export type ProjectableReviewStatus = "confirmed" | "corrected";

export interface ProjectionCandidate {
  stagedCandidateId: string;
  importRunId: string;
  stableRecordId: string;
  recordType: string;
  reviewStatus: ProjectableReviewStatus;
  sourceOrder: number;
  exactRecord: Readonly<Record<string, unknown>>;
  correctedRecord?: Readonly<Record<string, unknown>>;
}

export interface ProjectionCandidateResult {
  stagedCandidateId: string;
  stableRecordId: string;
  outcome: "projected" | "already_projected" | "blocked" | "failed";
  message?: string;
}

export interface HandoverProjectionReport {
  importRunId: string | null;
  projected: number;
  alreadyProjected: number;
  blocked: number;
  failed: number;
  results: ProjectionCandidateResult[];
}

export interface ProjectionWriteResult {
  outcome: "projected" | "already_projected";
}
