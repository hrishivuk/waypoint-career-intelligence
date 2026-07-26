import type { TemporalLifecycle } from "./lifecycle";

export type PolicyEnforcement =
  | "hard_rule"
  | "score_modifier"
  | "model_guidance"
  | "mixed";

export type PolicyTaskScope =
  | "job_analysis"
  | "cv_selection"
  | "cv_rewrite"
  | "cover_letter"
  | "interview_preparation"
  | "career_coaching";

export type DecisionEffect =
  | "block"
  | "require_investigation"
  | "increase"
  | "decrease"
  | "prefer"
  | "avoid"
  | "guidance_only"
  // v1 persisted aliases
  | "favour"
  | "prohibit"
  | "require";

export type DecisionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "exists"
  | "missing"
  | "stale"
  | "matches";

export interface DecisionPolicy extends TemporalLifecycle {
  id: string;
  candidateId: string;
  policyType: string;
  rule: string;
  enforcement: PolicyEnforcement;
  taskScopes: PolicyTaskScope[];
  careerModeId?: string;
  priority: number;
  exceptions: string[];
  decisionKey?: string;
  operator?: DecisionOperator;
  conditionValue?: string | number | boolean;
  effect?: DecisionEffect;
  modifier?: number;
  cvArtifactIds?: string[];
}

export interface PolicyConflict {
  decisionKey: string;
  priority: number;
  policyIds: string[];
}

const positive = new Set<DecisionEffect>(["increase", "prefer", "favour", "require"]);
const negative = new Set<DecisionEffect>(["decrease", "avoid", "block", "prohibit"]);

export function detectPolicyConflicts(
  policies: DecisionPolicy[],
): PolicyConflict[] {
  const grouped = new Map<string, DecisionPolicy[]>();
  for (const policy of policies) {
    if (!policy.decisionKey || !policy.effect) continue;
    const key = `${policy.decisionKey}:${policy.priority}`;
    grouped.set(key, [...(grouped.get(key) ?? []), policy]);
  }

  const conflicts: PolicyConflict[] = [];
  for (const policiesAtPriority of grouped.values()) {
    const effects = new Set(
      policiesAtPriority.flatMap((policy) =>
        policy.effect ? [policy.effect] : [],
      ),
    );
    const hasConflict =
      [...effects].some((effect) => positive.has(effect)) &&
      [...effects].some((effect) => negative.has(effect));
    if (hasConflict) {
      conflicts.push({
        decisionKey: policiesAtPriority[0].decisionKey!,
        priority: policiesAtPriority[0].priority,
        policyIds: policiesAtPriority.map((policy) => policy.id),
      });
    }
  }
  return conflicts;
}

export interface PolicyEffects {
  blockers: string[];
  investigations: string[];
  modifiers: Record<string, number>;
}

export function evaluatePolicyEffects(
  policies: DecisionPolicy[],
): PolicyEffects {
  const result: PolicyEffects = {
    blockers: [],
    investigations: [],
    modifiers: {},
  };
  for (const policy of policies) {
    if (!policy.decisionKey || !policy.effect) continue;
    if (policy.effect === "block" || policy.effect === "prohibit") {
      result.blockers.push(policy.id);
    } else if (policy.effect === "require_investigation") {
      result.investigations.push(policy.id);
    } else if (
      policy.effect === "increase" ||
      policy.effect === "decrease"
    ) {
      const amount = policy.modifier ?? 0;
      result.modifiers[policy.decisionKey] =
        (result.modifiers[policy.decisionKey] ?? 0) +
        (policy.effect === "decrease" ? -Math.abs(amount) : Math.abs(amount));
    }
  }
  return result;
}
