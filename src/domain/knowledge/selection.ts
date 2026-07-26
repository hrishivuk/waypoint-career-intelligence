import type { DecisionPolicy, PolicyTaskScope } from "./decision-policy";
import type { TemporalKnowledgeClass } from "./lifecycle";
import { knowledgeInfluence } from "./lifecycle";

export function selectApplicablePolicies(input: {
  policies: DecisionPolicy[];
  task: PolicyTaskScope;
  careerModeId: string;
  now: Date;
}): DecisionPolicy[] {
  return input.policies
    .filter(
      (policy) =>
        policy.taskScopes.includes(input.task) &&
        (!policy.careerModeId ||
          policy.careerModeId === input.careerModeId) &&
        knowledgeInfluence(policy, "slowly_changing", input.now) !== "inactive",
    )
    .sort((left, right) => left.priority - right.priority);
}

export function partitionKnowledgeByInfluence<T extends {
  lifecycle: Parameters<typeof knowledgeInfluence>[0];
  knowledgeClass: TemporalKnowledgeClass;
}>(records: T[], now: Date) {
  return records.reduce(
    (result, record) => {
      const influence = knowledgeInfluence(
        record.lifecycle,
        record.knowledgeClass,
        now,
      );
      result[influence].push(record);
      return result;
    },
    {
      active: [] as T[],
      active_with_warning: [] as T[],
      requires_confirmation: [] as T[],
      inactive: [] as T[],
    },
  );
}
