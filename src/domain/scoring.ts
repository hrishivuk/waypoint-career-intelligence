import {
  DEFAULT_SCORING_POLICY,
  type DimensionScores,
  type JobAnalysis,
  type RequirementAssessment,
  type ScoreAnalysisInput,
  type ScoringPolicy,
} from "./analysis";
import type { JobRequirement, ScoreDimension } from "./job";
import { confirmedFacts } from "./profile";

const dimensions: ScoreDimension[] = [
  "eligibility",
  "requirements",
  "context",
  "impact",
  "preference",
  "communication",
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 10) / 10;

function dimensionScore(
  requirements: JobRequirement[],
  assessments: Map<string, RequirementAssessment>,
): number {
  if (requirements.length === 0) return 50;

  let weightedMatches = 0;
  let totalImportance = 0;
  for (const requirement of requirements) {
    const assessment = assessments.get(requirement.id);
    const importance = Math.max(0, requirement.importance);
    const effectiveMatch = assessment
      ? clamp01(assessment.match) * clamp01(assessment.confidence)
      : 0;
    weightedMatches += effectiveMatch * importance;
    totalImportance += importance;
  }
  return totalImportance === 0 ? 50 : round((weightedMatches / totalImportance) * 100);
}

export function scoreJobAnalysis(
  input: ScoreAnalysisInput,
  policy: ScoringPolicy = DEFAULT_SCORING_POLICY,
): JobAnalysis {
  const confirmedIds = new Set(confirmedFacts(input.profile).map((fact) => fact.id));
  const assessments = input.assessments.map((assessment) => ({
    ...assessment,
    match: clamp01(assessment.match),
    confidence: clamp01(assessment.confidence),
    evidence: assessment.evidence.filter((citation) =>
      confirmedIds.has(citation.profileFactId),
    ),
  }));
  const assessmentsById = new Map(
    assessments.map((assessment) => [assessment.requirementId, assessment]),
  );

  const dimensionScores = Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      dimensionScore(
        input.job.requirements.filter((requirement) => requirement.dimension === dimension),
        assessmentsById,
      ),
    ]),
  ) as DimensionScores;

  const blockers = input.job.requirements
    .filter((requirement) => {
      const assessment = assessmentsById.get(requirement.id);
      return requirement.mandatory && (!assessment || assessment.match < 0.5);
    })
    .map((requirement) => requirement.statement);

  const uncertainty = input.job.requirements
    .filter((requirement) => {
      const assessment = assessmentsById.get(requirement.id);
      return !assessment || assessment.confidence < 0.6 || requirement.confidence < 0.6;
    })
    .map((requirement) => requirement.statement);

  const overallScore = round(
    dimensions.reduce(
      (total, dimension) => total + dimensionScores[dimension] * policy.weights[dimension],
      0,
    ),
  );

  const recommendation =
    blockers.length === 0 &&
    dimensionScores.eligibility >= policy.minimumEligibilityForApply &&
    overallScore >= policy.applyThreshold
      ? "apply"
      : overallScore >= policy.investigateThreshold || uncertainty.length > 0
        ? "investigate"
        : "skip";

  return {
    id: input.id,
    candidateId: input.profile.candidateId,
    jobId: input.job.id,
    recommendation,
    overallScore,
    dimensionScores,
    assessments,
    blockers,
    uncertainty,
    policyVersion: policy.version,
    createdAt: input.createdAt,
  };
}

