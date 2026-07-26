import type { JobSourceCitation, ParsedJob, ScoreDimension } from "./job";
import type { CareerProfile } from "./profile";

export interface EvidenceCitation {
  profileFactId: string;
  jobRequirementId: string;
  jobSource: JobSourceCitation;
}

export interface RequirementAssessment {
  requirementId: string;
  match: number;
  confidence: number;
  rationale: string;
  evidence: EvidenceCitation[];
}

export type DimensionScores = Record<ScoreDimension, number>;
export type Recommendation = "apply" | "investigate" | "skip";

export interface ScoringPolicy {
  version: string;
  weights: Record<ScoreDimension, number>;
  applyThreshold: number;
  investigateThreshold: number;
  minimumEligibilityForApply: number;
}

export interface JobAnalysis {
  id: string;
  candidateId: string;
  jobId: string;
  recommendation: Recommendation;
  overallScore: number;
  dimensionScores: DimensionScores;
  assessments: RequirementAssessment[];
  blockers: string[];
  uncertainty: string[];
  policyVersion: string;
  createdAt: string;
}

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  version: "career-fit-v1",
  weights: {
    eligibility: 0.25,
    requirements: 0.2,
    context: 0.1,
    impact: 0.15,
    preference: 0.2,
    communication: 0.1,
  },
  applyThreshold: 70,
  investigateThreshold: 45,
  minimumEligibilityForApply: 60,
};

export interface ScoreAnalysisInput {
  id: string;
  profile: CareerProfile;
  job: ParsedJob;
  assessments: RequirementAssessment[];
  createdAt: string;
}

