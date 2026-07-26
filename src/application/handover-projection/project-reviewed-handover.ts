import type {
  HandoverProjectionReport,
  ProjectionCandidate,
  ProjectionCandidateResult,
} from "./contracts";
import type { HandoverProjectionRepository } from "./ports";

export class ProjectReviewedHandover {
  constructor(private readonly repository: HandoverProjectionRepository) {}

  async execute(candidateId: string): Promise<HandoverProjectionReport> {
    const staged = await this.repository.findReviewedCandidates(candidateId);
    const results: ProjectionCandidateResult[] = [];
    const candidatesByStableId = new Map(
      staged.candidates.map((candidate) => [candidate.stableRecordId, candidate]),
    );
    const ordered = dependencyOrder(staged.candidates);
    const successful = new Set<string>();

    for (const candidate of ordered) {
      const dependencies = projectionDependencies(effectiveRecord(candidate));
      const unavailable = dependencies.filter(
        (dependency) => !candidatesByStableId.has(dependency),
      );
      const unsuccessful = dependencies.filter(
        (dependency) =>
          candidatesByStableId.has(dependency) && !successful.has(dependency),
      );
      if (unavailable.length > 0 || unsuccessful.length > 0) {
        results.push({
          stagedCandidateId: candidate.stagedCandidateId,
          stableRecordId: candidate.stableRecordId,
          outcome: "blocked",
          message: `Projection dependency unavailable: ${[
            ...unavailable,
            ...unsuccessful,
          ].join(", ")}.`,
        });
        continue;
      }
      try {
        const projected = await this.repository.projectOne({
          candidateId,
          stagedCandidateId: candidate.stagedCandidateId,
        });
        successful.add(candidate.stableRecordId);
        results.push({
          stagedCandidateId: candidate.stagedCandidateId,
          stableRecordId: candidate.stableRecordId,
          outcome: projected.outcome,
        });
      } catch (error) {
        results.push({
          stagedCandidateId: candidate.stagedCandidateId,
          stableRecordId: candidate.stableRecordId,
          outcome: "failed",
          message: error instanceof Error ? error.message : "Projection failed.",
        });
      }
    }

    return {
      importRunId: staged.importRunId,
      projected: count(results, "projected"),
      alreadyProjected: count(results, "already_projected"),
      blocked: count(results, "blocked"),
      failed: count(results, "failed"),
      results,
    };
  }
}

export function dependencyOrder(
  candidates: ProjectionCandidate[],
): ProjectionCandidate[] {
  const byId = new Map(
    candidates.map((candidate) => [candidate.stableRecordId, candidate]),
  );
  const remaining = new Set(byId.keys());
  const ordered: ProjectionCandidate[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .map((id) => byId.get(id)!)
      .filter((candidate) =>
        projectionDependencies(effectiveRecord(candidate)).every(
          (dependency) => !remaining.has(dependency),
        ),
      )
      .sort(compareCandidates);
    if (ready.length === 0) {
      // Cycles remain deterministic and will be rejected/blocked by persistence.
      ready.push(
        [...remaining]
          .map((id) => byId.get(id)!)
          .sort(compareCandidates)[0],
      );
    }
    for (const candidate of ready) {
      remaining.delete(candidate.stableRecordId);
      ordered.push(candidate);
    }
  }
  return ordered;
}

export function effectiveRecord(
  candidate: ProjectionCandidate,
): Readonly<Record<string, unknown>> {
  return candidate.reviewStatus === "corrected" && candidate.correctedRecord
    ? candidate.correctedRecord
    : candidate.exactRecord;
}

export function projectionDependencies(
  record: Readonly<Record<string, unknown>>,
): string[] {
  const references = [
    ...strings(record.mode),
    ...strings(record.skill_ref),
    ...strings(record.parent_ref),
    ...strings(record.supersedes),
    ...strings(record.cv_artifact_refs),
    ...strings(record.evidence_refs),
  ];
  return [...new Set(references)];
}

function compareCandidates(
  left: ProjectionCandidate,
  right: ProjectionCandidate,
): number {
  return (
    typePriority(left.recordType) - typePriority(right.recordType) ||
    left.sourceOrder - right.sourceOrder ||
    left.stableRecordId.localeCompare(right.stableRecordId)
  );
}

function typePriority(type: string): number {
  if (type === "career_mode") return 0;
  if (["skill", "evidence", "cv_artifact"].includes(type)) return 10;
  if (type === "capability_assessment") return 30;
  if (type === "decision_policy") return 40;
  return 20;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function count(
  results: ProjectionCandidateResult[],
  outcome: ProjectionCandidateResult["outcome"],
): number {
  return results.filter((result) => result.outcome === outcome).length;
}
