import { handoverRecordV11Schema } from "../../domain/knowledge";
import type {
  ReviewHandoverCandidateInput,
  StagedReviewCandidate,
} from "./contracts";
import {
  HandoverReviewNotFoundError,
  InvalidHandoverReviewError,
} from "./errors";
import type { HandoverReviewRepository } from "./ports";

export class ReviewHandoverCandidate {
  constructor(private readonly repository: HandoverReviewRepository) {}

  async execute(
    input: ReviewHandoverCandidateInput,
  ): Promise<StagedReviewCandidate> {
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
      throw new InvalidHandoverReviewError(
        "expectedVersion must be a non-negative integer.",
      );
    }
    if (input.action === "correct") {
      if (!input.correctedRecord) {
        throw new InvalidHandoverReviewError(
          "correctedRecord is required for correction.",
        );
      }
      const staged = await this.repository.findOne(
        input.candidateId,
        input.stagedCandidateId,
      );
      if (!staged) {
        throw new HandoverReviewNotFoundError(
          "The staged candidate does not exist.",
        );
      }
      const parsed = handoverRecordV11Schema.safeParse(input.correctedRecord);
      if (!parsed.success) {
        throw new InvalidHandoverReviewError(
          `Corrected record is invalid: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`,
        );
      }
      if (
        parsed.data.id !== staged.stableRecordId ||
        parsed.data.type !== staged.recordType ||
        parsed.data.status !== "proposed"
      ) {
        throw new InvalidHandoverReviewError(
          "A corrected record must preserve its identity, type, and proposed status.",
        );
      }
    } else if (input.correctedRecord !== undefined) {
      throw new InvalidHandoverReviewError(
        "correctedRecord is accepted only for correction.",
      );
    }

    return this.repository.reviewOne(input);
  }
}
