import { describe, expect, it } from "vitest";
import type {
  CareerProfile,
  JobRequirement,
  ParsedJob,
  RequirementAssessment,
} from ".";
import { scoreJobAnalysis } from "./scoring";

const requirement = (
  id: string,
  dimension: JobRequirement["dimension"],
  mandatory = false,
): JobRequirement => ({
  id,
  dimension,
  mandatory,
  statement: `${dimension} requirement`,
  importance: 1,
  confidence: 1,
  source: { start: 0, end: 10, excerpt: "requirement" },
});

const profile: CareerProfile = {
  candidateId: "candidate-1",
  updatedAt: "2026-07-24T00:00:00.000Z",
  facts: [
    {
      id: "confirmed",
      category: "skill",
      statement: "TypeScript",
      confidence: 1,
      confirmation: "confirmed",
      provenance: [
        {
          sourceId: "cv-1",
          sourceType: "cv",
          capturedAt: "2026-07-24T00:00:00.000Z",
        },
      ],
      tags: ["typescript"],
    },
    {
      id: "proposed",
      category: "skill",
      statement: "Rust",
      confidence: 0.8,
      confirmation: "proposed",
      provenance: [],
      tags: ["rust"],
    },
  ],
};

function score(
  requirements: JobRequirement[],
  assessments: RequirementAssessment[],
) {
  const job: ParsedJob = {
    id: "job-1",
    candidateId: profile.candidateId,
    description: "A role",
    requirements,
    createdAt: "2026-07-24T00:00:00.000Z",
  };
  return scoreJobAnalysis({
    id: "analysis-1",
    profile,
    job,
    assessments,
    createdAt: "2026-07-24T00:00:00.000Z",
  });
}

describe("scoreJobAnalysis", () => {
  it("scores all six dimensions deterministically and recommends apply", () => {
    const requirements = [
      requirement("e", "eligibility"),
      requirement("r", "requirements"),
      requirement("c", "context"),
      requirement("i", "impact"),
      requirement("p", "preference"),
      requirement("m", "communication"),
    ];
    const assessments = requirements.map((item) => ({
      requirementId: item.id,
      match: 1,
      confidence: 1,
      rationale: "Strong match",
      evidence: [],
    }));

    const result = score(requirements, assessments);

    expect(result.dimensionScores).toEqual({
      eligibility: 100,
      requirements: 100,
      context: 100,
      impact: 100,
      preference: 100,
      communication: 100,
    });
    expect(result.overallScore).toBe(100);
    expect(result.recommendation).toBe("apply");
  });

  it("makes an unmet mandatory requirement a blocker", () => {
    const result = score([requirement("visa", "eligibility", true)], [
      {
        requirementId: "visa",
        match: 0,
        confidence: 1,
        rationale: "Not eligible",
        evidence: [],
      },
    ]);

    expect(result.blockers).toEqual(["eligibility requirement"]);
    expect(result.recommendation).not.toBe("apply");
  });

  it("removes citations to facts the candidate has not confirmed", () => {
    const req = requirement("skill", "requirements");
    const result = score([req], [
      {
        requirementId: req.id,
        match: 1,
        confidence: 1,
        rationale: "Matched",
        evidence: [
          { profileFactId: "confirmed", jobRequirementId: req.id, jobSource: req.source },
          { profileFactId: "proposed", jobRequirementId: req.id, jobSource: req.source },
        ],
      },
    ]);

    expect(result.assessments[0].evidence).toHaveLength(1);
    expect(result.assessments[0].evidence[0].profileFactId).toBe("confirmed");
  });
});

