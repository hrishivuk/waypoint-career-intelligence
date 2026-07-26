import type { TemporalLifecycle } from "./lifecycle";

export interface Skill {
  id: string;
  candidateId: string;
  name: string;
  category?: string;
  aliases: string[];
}

export type CapabilityLevel =
  | "awareness"
  | "beginner"
  | "working"
  | "proficient"
  | "advanced"
  | "expert";

export interface CapabilityAssessment extends TemporalLifecycle {
  id: string;
  candidateId: string;
  skillId: string;
  currentLevel: CapabilityLevel;
  targetLevel?: CapabilityLevel;
  evidenceIds: string[];
  assessedAt: string;
  context?: string;
  developmentObjective?: string;
}

