export type FactConfirmation =
  | "proposed"
  | "confirmed"
  | "rejected"
  | "superseded"
  | "stale";

export type ProfileFactCategory =
  | "career_goal"
  | "interest"
  | "preference"
  | "deal_breaker"
  | "eligibility"
  | "skill"
  | "experience"
  | "achievement"
  | "education"
  | "writing_style";

export interface FactProvenance {
  sourceId: string;
  sourceType: "cv" | "chat_handover" | "user_input" | "analysis_feedback";
  locator?: string;
  excerpt?: string;
  capturedAt: string;
}

export interface ProfileFact {
  id: string;
  category: ProfileFactCategory;
  statement: string;
  confidence: number;
  confirmation: FactConfirmation;
  provenance: FactProvenance[];
  tags: string[];
}

export interface CareerProfile {
  candidateId: string;
  facts: ProfileFact[];
  updatedAt: string;
}

export function confirmedFacts(profile: CareerProfile): ProfileFact[] {
  return profile.facts.filter((fact) => fact.confirmation === "confirmed");
}
