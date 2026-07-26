import type { ListProfileFactsResult } from "./contracts";
import { toProfileFactDto } from "./contracts";
import type { ProfileFactRepository } from "./ports";
import { validateCandidateId } from "./validation";

export class ListProfileFacts {
  constructor(private readonly facts: ProfileFactRepository) {}

  async execute(candidateId: string): Promise<ListProfileFactsResult> {
    validateCandidateId(candidateId);
    const facts = await this.facts.listByCandidateId(candidateId);
    if (facts.some((fact) => fact.candidateId !== candidateId)) {
      throw new Error("Profile fact repository returned data owned by another candidate");
    }
    return { facts: facts.map(toProfileFactDto) };
  }
}
