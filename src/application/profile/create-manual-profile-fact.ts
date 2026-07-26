import {
  type CreateManualProfileFactInput,
  type ProfileFactDto,
  type StoredProfileFact,
  toProfileFactDto,
} from "./contracts";
import type {
  ProfileFactClock,
  ProfileFactIdGenerator,
  ProfileFactRepository,
} from "./ports";
import {
  validateCandidateId,
  validateCategory,
  validateStatement,
  validateTags,
} from "./validation";

export class CreateManualProfileFact {
  constructor(
    private readonly dependencies: {
      facts: ProfileFactRepository;
      ids: ProfileFactIdGenerator;
      clock: ProfileFactClock;
    },
  ) {}

  async execute(input: CreateManualProfileFactInput): Promise<ProfileFactDto> {
    validateCandidateId(input.candidateId);
    validateCategory(input.category);
    const statement = validateStatement(input.statement);
    const tags = validateTags(input.tags ?? []);
    const now = this.dependencies.clock.now().toISOString();
    const id = this.dependencies.ids.generate();
    const fact: StoredProfileFact = {
      id,
      candidateId: input.candidateId,
      category: input.category,
      statement,
      tags,
      confirmation: "confirmed",
      confidence: 1,
      provenance: [
        {
          sourceId: id,
          sourceType: "user_input",
          capturedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      reviewedAt: now,
    };
    const created = await this.dependencies.facts.create(fact);
    if (created.candidateId !== input.candidateId) {
      throw new Error("Profile fact repository created data for another candidate");
    }
    return toProfileFactDto(created);
  }
}
