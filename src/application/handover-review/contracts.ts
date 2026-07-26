export type HandoverReviewAction = "confirm" | "reject" | "correct";
export type HandoverCandidateReviewStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "corrected";

export interface StagedImportSummary {
  id: string;
  specificationVersion: "1.1";
  status: string;
  candidateCount: number;
  createdAt: string;
}

export interface StagedReviewCandidate {
  id: string;
  importRunId: string;
  stableRecordId: string;
  recordType: string;
  exactRecord: Readonly<Record<string, unknown>>;
  correctedRecord?: Readonly<Record<string, unknown>>;
  effectiveRecord: Readonly<Record<string, unknown>>;
  section?: string;
  sourceOrder: number;
  reviewStatus: HandoverCandidateReviewStatus;
  version: number;
  reviewedAt?: string;
}

export interface ActiveHandoverReview {
  importRun: StagedImportSummary | null;
  candidates: StagedReviewCandidate[];
}

export interface ReviewHandoverCandidateInput {
  candidateId: string;
  stagedCandidateId: string;
  action: HandoverReviewAction;
  expectedVersion: number;
  correctedRecord?: Readonly<Record<string, unknown>>;
}
