import type { Recommendation } from "../analysis";

export type AnalysisAxis =
  | "eligibility"
  | "requirements_coverage"
  | "evidence_strength"
  | "career_direction_alignment"
  | "personal_interest"
  | "growth_opportunity"
  | "application_competitiveness"
  | "practical_attractiveness"
  | "preference_alignment";

export type ApplicationPosture =
  | "strong_fit"
  | "competitive"
  | "ambitious"
  | "exploratory";

export interface AnalysisEvidenceCitation {
  evidenceId: string;
  claim: string;
  excerpt?: string;
}

export interface AnalysisAxisResult {
  axis: AnalysisAxis;
  score: number;
  confidence: number;
  rationale: string;
  citations: AnalysisEvidenceCitation[];
}

export interface ModeAwareJobAnalysis {
  id: string;
  candidateId: string;
  jobId: string;
  selectedCareerModeId: string;
  recommendation: Recommendation;
  applicationPosture: ApplicationPosture;
  dimensions: Record<AnalysisAxis, AnalysisAxisResult>;
  blockers: string[];
  uncertainties: string[];
  tradeOffs: string[];
  scoringPolicyVersion: string;
  createdAt: string;
}

export interface RecommendationPolicy {
  version: string;
  minimumEligibility: number;
  minimumDirectionAlignment: number;
  applyValueThreshold: number;
  investigateValueThreshold: number;
}

export const DEFAULT_RECOMMENDATION_POLICY: RecommendationPolicy = {
  version: "mode-aware-v2",
  minimumEligibility: 60,
  minimumDirectionAlignment: 45,
  applyValueThreshold: 65,
  investigateValueThreshold: 45,
};

const valueAxes: AnalysisAxis[] = [
  "career_direction_alignment",
  "personal_interest",
  "growth_opportunity",
  "practical_attractiveness",
  "preference_alignment",
];

export function decideModeAwareRecommendation(
  input: Omit<
    ModeAwareJobAnalysis,
    "recommendation" | "applicationPosture" | "scoringPolicyVersion"
  > & {
    staleCriticalConstraints: string[];
  },
  policy: RecommendationPolicy = DEFAULT_RECOMMENDATION_POLICY,
): Pick<
  ModeAwareJobAnalysis,
  "recommendation" | "applicationPosture" | "scoringPolicyVersion"
> {
  const score = (axis: AnalysisAxis) => input.dimensions[axis].score;
  const valueScore =
    valueAxes.reduce((total, axis) => total + score(axis), 0) /
    valueAxes.length;

  let recommendation: Recommendation;
  if (
    input.blockers.length > 0 ||
    score("eligibility") < policy.minimumEligibility ||
    score("career_direction_alignment") < policy.minimumDirectionAlignment
  ) {
    recommendation = "skip";
  } else if (
    input.staleCriticalConstraints.length > 0 ||
    input.uncertainties.length > 0 ||
    valueScore < policy.applyValueThreshold
  ) {
    recommendation =
      valueScore >= policy.investigateValueThreshold
        ? "investigate"
        : "skip";
  } else {
    recommendation = "apply";
  }

  const evidence = score("evidence_strength");
  const competitiveness = score("application_competitiveness");
  const alignment = score("career_direction_alignment");
  const growth = score("growth_opportunity");
  const applicationPosture: ApplicationPosture =
    recommendation === "apply" && evidence >= 75 && competitiveness >= 70
      ? "strong_fit"
      : evidence >= 60 && competitiveness >= 55
        ? "competitive"
        : alignment >= 70 && growth >= 65
          ? "ambitious"
          : "exploratory";

  return {
    recommendation,
    applicationPosture,
    scoringPolicyVersion: policy.version,
  };
}

