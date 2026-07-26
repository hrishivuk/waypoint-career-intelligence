import type { TemporalLifecycle } from "./lifecycle";

export interface TemporaryCareerState extends TemporalLifecycle {
  id: string;
  candidateId: string;
  stateType:
    | "availability"
    | "job_search_urgency"
    | "active_learning_focus"
    | "interview_confidence"
    | "portfolio_readiness"
    | "target_location"
    | "cv_status";
  value: string;
  careerModeId?: string;
}

export function validateTemporaryState(
  state: TemporaryCareerState,
): string[] {
  return state.validUntil || state.reviewAfter
    ? []
    : ["Temporary state requires validUntil or reviewAfter."];
}

export interface HistoricalObservation extends TemporalLifecycle {
  id: string;
  candidateId: string;
  observationType:
    | "decision"
    | "preference"
    | "application_outcome"
    | "interview_outcome"
    | "feedback";
  statement: string;
  observedAt: string;
  relatedJobId?: string;
}

export interface KnowledgeUncertainty extends TemporalLifecycle {
  id: string;
  candidateId: string;
  topic: string;
  description: string;
  resolutionNeeded: string;
  contradicts: string[];
  candidateValues: string[];
}
