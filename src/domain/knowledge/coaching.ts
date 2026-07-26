import type { DecisionPolicy } from "./decision-policy";
import type { TemporalLifecycle } from "./lifecycle";

export type CoachingPolicy = DecisionPolicy & {
  policyType: "coaching_behaviour";
};

export interface WorkingStyleContext extends TemporalLifecycle {
  id: string;
  candidateId: string;
  trait: string;
  description: string;
  careerModeId?: string;
}

