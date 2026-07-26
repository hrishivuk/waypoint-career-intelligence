import type { ProfileFactCategory } from "../../domain/profile";
import { InvalidProfileFactError } from "./errors";

const profileFactCategories: readonly ProfileFactCategory[] = [
  "career_goal",
  "interest",
  "preference",
  "deal_breaker",
  "eligibility",
  "skill",
  "experience",
  "achievement",
  "education",
  "writing_style",
];

export function validateCandidateId(candidateId: string): void {
  if (!candidateId.trim()) {
    throw new InvalidProfileFactError("Candidate id is required");
  }
}

export function validateCategory(category: ProfileFactCategory): void {
  if (!profileFactCategories.includes(category)) {
    throw new InvalidProfileFactError(`Unsupported profile fact category: ${category}`);
  }
}

export function validateStatement(statement: string): string {
  const normalized = statement.trim();
  if (!normalized) {
    throw new InvalidProfileFactError("Profile fact statement is required");
  }
  if (normalized.length > 2_000) {
    throw new InvalidProfileFactError(
      "Profile fact statement must be 2000 characters or fewer",
    );
  }
  return normalized;
}

export function validateTags(tags: string[]): string[] {
  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (normalized.length > 20) {
    throw new InvalidProfileFactError("A profile fact can have at most 20 tags");
  }
  if (normalized.some((tag) => tag.length > 50)) {
    throw new InvalidProfileFactError("Profile fact tags must be 50 characters or fewer");
  }
  return normalized;
}
