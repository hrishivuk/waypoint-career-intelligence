import type { LifecycleDate, TemporalLifecycle } from "./lifecycle";
import type { DecisionPolicy } from "./decision-policy";

export interface CvArtifact extends TemporalLifecycle {
  id: string;
  candidateId: string;
  name: string;
  intendedRoleFamilies: string[];
  sourceDocumentId: string;
  revision?: string;
  emphasis?: string;
  supersedesId?: string;
  lastReviewedAt?: LifecycleDate;
}

export function validateCvPolicyReferences(
  policies: DecisionPolicy[],
  artifacts: CvArtifact[],
): string[] {
  const known = new Set(artifacts.map((artifact) => artifact.id));
  return policies.flatMap((policy) =>
    (policy.cvArtifactIds ?? []).flatMap((reference) =>
      known.has(reference)
        ? []
        : [`Policy ${policy.id} references unknown CV ${reference}.`],
    ),
  );
}
