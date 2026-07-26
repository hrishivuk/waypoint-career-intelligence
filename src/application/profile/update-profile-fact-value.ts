import { type ProfileFactDto, type UpdateProfileFactValueInput, toProfileFactDto } from "./contracts";
import {
  InvalidProfileFactError,
  InvalidProfileFactTransitionError,
  ProfileFactNotFoundError,
} from "./errors";
import type { ProfileFactClock, ProfileFactRepository } from "./ports";
import { validateCandidateId, validateStatement } from "./validation";

export class UpdateProfileFactValue {
  constructor(
    private readonly dependencies: {
      facts: ProfileFactRepository;
      clock: ProfileFactClock;
    },
  ) {}

  async execute(input: UpdateProfileFactValueInput): Promise<ProfileFactDto> {
    validateCandidateId(input.candidateId);
    if (input.statement === undefined && input.confirmation === undefined) {
      throw new InvalidProfileFactError("At least one profile fact change is required");
    }
    const current = await this.dependencies.facts.getById(
      input.candidateId,
      input.factId,
    );
    if (!current) throw new ProfileFactNotFoundError(input.factId);
    if (
      input.confirmation !== undefined &&
      (current.confirmation !== "proposed" ||
        !["confirmed", "rejected"].includes(input.confirmation))
    ) {
      throw new InvalidProfileFactTransitionError(current.confirmation);
    }
    const now = this.dependencies.clock.now().toISOString();
    const updated = await this.dependencies.facts.update({
      ...current,
      statement:
        input.statement === undefined
          ? current.statement
          : validateStatement(input.statement),
      confirmation: input.confirmation ?? current.confirmation,
      reviewedAt: input.confirmation === undefined ? current.reviewedAt : now,
      updatedAt: now,
    });
    if (updated.candidateId !== input.candidateId) {
      throw new Error("Profile fact repository updated data for another candidate");
    }
    return toProfileFactDto(updated);
  }
}
