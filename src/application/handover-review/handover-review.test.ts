import { describe, expect, it, vi } from "vitest";

import type { HandoverReviewRepository, StagedReviewCandidate } from ".";
import {
  HandoverReviewNotFoundError,
  InvalidHandoverReviewError,
  ListActiveHandoverReview,
  ReviewHandoverCandidate,
} from ".";

const candidate: StagedReviewCandidate = {
  id: "00000000-0000-4000-8000-000000000010",
  importRunId: "00000000-0000-4000-8000-000000000020",
  stableRecordId: "skill-react",
  recordType: "skill",
  exactRecord: record(),
  effectiveRecord: record(),
  sourceOrder: 0,
  reviewStatus: "pending",
  version: 0,
};

describe("handover review application services", () => {
  it("lists only through the owner-scoped repository input", async () => {
    const repository = fakeRepository();
    const service = new ListActiveHandoverReview(repository);
    await service.execute("owner-id");
    expect(repository.findActive).toHaveBeenCalledWith("owner-id");
  });

  it("reviews exactly one candidate with optimistic version", async () => {
    const repository = fakeRepository();
    const service = new ReviewHandoverCandidate(repository);
    await service.execute({
      candidateId: "owner-id",
      stagedCandidateId: candidate.id,
      action: "confirm",
      expectedVersion: 0,
    });
    expect(repository.reviewOne).toHaveBeenCalledWith({
      candidateId: "owner-id",
      stagedCandidateId: candidate.id,
      action: "confirm",
      expectedVersion: 0,
    });
  });

  it("validates a full correction and preserves identity and proposed status", async () => {
    const repository = fakeRepository();
    const service = new ReviewHandoverCandidate(repository);
    const correctedRecord = { ...record(), name: "React.js" };
    await expect(
      service.execute({
        candidateId: "owner-id",
        stagedCandidateId: candidate.id,
        action: "correct",
        expectedVersion: 0,
        correctedRecord,
      }),
    ).resolves.toBe(candidate);
    expect(repository.findOne).toHaveBeenCalledWith("owner-id", candidate.id);
  });

  it("rejects invalid, identity-changing, and bulk-shaped corrections", async () => {
    const repository = fakeRepository();
    const service = new ReviewHandoverCandidate(repository);
    await expect(
      service.execute({
        candidateId: "owner-id",
        stagedCandidateId: candidate.id,
        action: "correct",
        expectedVersion: 0,
        correctedRecord: { ...record(), id: "skill-other" },
      }),
    ).rejects.toBeInstanceOf(InvalidHandoverReviewError);
    await expect(
      service.execute({
        candidateId: "owner-id",
        stagedCandidateId: candidate.id,
        action: "correct",
        expectedVersion: 0,
        correctedRecord: { records: [record()] },
      }),
    ).rejects.toBeInstanceOf(InvalidHandoverReviewError);
    expect(repository.reviewOne).not.toHaveBeenCalled();
  });

  it("fails correction when the owner-scoped staged candidate is absent", async () => {
    const repository = fakeRepository();
    vi.mocked(repository.findOne).mockResolvedValue(null);
    await expect(
      new ReviewHandoverCandidate(repository).execute({
        candidateId: "other-owner",
        stagedCandidateId: candidate.id,
        action: "correct",
        expectedVersion: 0,
        correctedRecord: record(),
      }),
    ).rejects.toBeInstanceOf(HandoverReviewNotFoundError);
  });
});

function fakeRepository(): HandoverReviewRepository {
  return {
    findActive: vi.fn().mockResolvedValue({
      importRun: null,
      candidates: [],
    }),
    findOne: vi.fn().mockResolvedValue(candidate),
    reviewOne: vi.fn().mockResolvedValue(candidate),
  };
}

function record() {
  return {
    type: "skill",
    id: "skill-react",
    status: "proposed",
    confidence: "high",
    criticality: "normal",
    provenance: {
      source_type: "chatgpt_handover",
      source_ref: "career conversation",
      basis: "explicitly_stated",
    },
    name: "React",
    category: "frontend",
  };
}
