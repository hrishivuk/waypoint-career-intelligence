import type {
  ProjectionCandidate,
  ProjectionWriteResult,
} from "./contracts";

export interface HandoverProjectionRepository {
  findReviewedCandidates(candidateId: string): Promise<{
    importRunId: string | null;
    candidates: ProjectionCandidate[];
  }>;
  projectOne(input: {
    candidateId: string;
    stagedCandidateId: string;
  }): Promise<ProjectionWriteResult>;
}
