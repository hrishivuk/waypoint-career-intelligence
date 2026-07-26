import { describe, expect, it, vi } from "vitest";

import type {
  HandoverProjectionRepository,
  ProjectionCandidate,
} from ".";
import {
  dependencyOrder,
  effectiveRecord,
  ProjectReviewedHandover,
} from ".";

describe("ProjectReviewedHandover", () => {
  it("projects only repository-selected reviewed candidates in dependency order", async () => {
    const candidates = [
      candidate("cap-react", "capability_assessment", 1, {
        skill_ref: "skill-react",
      }),
      candidate("policy-cv", "decision_policy", 2, {
        cv_artifact_refs: ["cv-frontend"],
      }),
      candidate("cv-frontend", "cv_artifact", 3),
      candidate("skill-react", "skill", 4),
      candidate("primary-career", "career_mode", 5),
    ];
    const repository = fakeRepository(candidates);
    const report = await new ProjectReviewedHandover(repository).execute("owner");
    expect(vi.mocked(repository.projectOne).mock.calls.map(
      ([input]) => input.stagedCandidateId,
    )).toEqual([
      "db-primary-career",
      "db-cv-frontend",
      "db-skill-react",
      "db-cap-react",
      "db-policy-cv",
    ]);
    expect(report).toMatchObject({
      projected: 5,
      alreadyProjected: 0,
      blocked: 0,
      failed: 0,
    });
  });

  it("uses corrected records for dependencies", () => {
    const corrected = candidate("cap-react", "capability_assessment", 0, {
      skill_ref: "old-skill",
    }, {
      skill_ref: "skill-react",
    });
    expect(effectiveRecord(corrected).skill_ref).toBe("skill-react");
  });

  it("blocks candidates whose dependency is pending, rejected, or failed", async () => {
    const candidates = [
      candidate("cap-missing", "capability_assessment", 1, {
        skill_ref: "pending-skill",
      }),
      candidate("skill-fails", "skill", 2),
      candidate("cap-fails", "capability_assessment", 3, {
        skill_ref: "skill-fails",
      }),
    ];
    const repository = fakeRepository(candidates);
    vi.mocked(repository.projectOne).mockImplementation(async ({ stagedCandidateId }) => {
      if (stagedCandidateId === "db-skill-fails") throw new Error("database failure");
      return { outcome: "projected" };
    });
    const report = await new ProjectReviewedHandover(repository).execute("owner");
    expect(report).toMatchObject({ projected: 0, blocked: 2, failed: 1 });
  });

  it("safely resumes and reports already-projected records", async () => {
    const repository = fakeRepository([
      candidate("skill-react", "skill", 0),
      candidate("evidence-project", "evidence", 1),
    ]);
    vi.mocked(repository.projectOne)
      .mockResolvedValueOnce({ outcome: "already_projected" })
      .mockResolvedValueOnce({ outcome: "projected" });
    const report = await new ProjectReviewedHandover(repository).execute("owner");
    expect(report).toMatchObject({
      projected: 1,
      alreadyProjected: 1,
      blocked: 0,
      failed: 0,
    });
  });

  it("orders equal-priority candidates by source order then stable ID", () => {
    expect(
      dependencyOrder([
        candidate("second", "skill", 2),
        candidate("first", "skill", 1),
      ]).map((item) => item.stableRecordId),
    ).toEqual(["first", "second"]);
  });
});

function fakeRepository(
  candidates: ProjectionCandidate[],
): HandoverProjectionRepository {
  return {
    findReviewedCandidates: vi.fn().mockResolvedValue({
      importRunId: "run",
      candidates,
    }),
    projectOne: vi.fn().mockResolvedValue({ outcome: "projected" }),
  };
}

function candidate(
  id: string,
  recordType: string,
  sourceOrder: number,
  fields: Record<string, unknown> = {},
  correction?: Record<string, unknown>,
): ProjectionCandidate {
  const exactRecord = {
    id,
    type: recordType,
    status: "proposed",
    ...fields,
  };
  return {
    stagedCandidateId: `db-${id}`,
    importRunId: "run",
    stableRecordId: id,
    recordType,
    reviewStatus: correction ? "corrected" : "confirmed",
    sourceOrder,
    exactRecord,
    ...(correction
      ? {
          correctedRecord: { ...exactRecord, ...correction },
        }
      : {}),
  };
}
