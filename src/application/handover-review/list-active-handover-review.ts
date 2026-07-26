import type { ActiveHandoverReview } from "./contracts";
import type { HandoverReviewRepository } from "./ports";

export class ListActiveHandoverReview {
  constructor(private readonly repository: HandoverReviewRepository) {}

  execute(candidateId: string): Promise<ActiveHandoverReview> {
    return this.repository.findActive(candidateId);
  }
}
