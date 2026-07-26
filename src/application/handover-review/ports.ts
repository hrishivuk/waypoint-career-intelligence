import type {
  ActiveHandoverReview,
  HandoverReviewAction,
  StagedReviewCandidate,
} from "./contracts";

export interface HandoverReviewRepository {
  findActive(candidateId: string): Promise<ActiveHandoverReview>;
  findOne(
    candidateId: string,
    stagedCandidateId: string,
  ): Promise<StagedReviewCandidate | null>;
  reviewOne(input: {
    candidateId: string;
    stagedCandidateId: string;
    action: HandoverReviewAction;
    expectedVersion: number;
    correctedRecord?: Readonly<Record<string, unknown>>;
  }): Promise<StagedReviewCandidate>;
}
