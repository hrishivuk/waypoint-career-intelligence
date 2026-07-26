import { describe, expect, it } from "vitest";

import {
  confirmedEvidence,
  createDefaultCareerModes,
  decideModeAwareRecommendation,
  detectPolicyConflicts,
  isConfirmedHardPreference,
  knowledgeInfluence,
  selectApplicablePolicies,
  selectCareerMode,
  type AnalysisAxis,
  type AnalysisAxisResult,
  type CareerPreference,
  type DecisionPolicy,
  type EvidenceRecord,
} from ".";

const now = new Date("2026-07-24T12:00:00.000Z");
const lifecycle = {
  status: "confirmed" as const,
  confidence: 1,
  sources: [],
  tags: [],
};

describe("frozen knowledge architecture", () => {
  it("requires explicit active career-mode selection", () => {
    const modes = [
      {
        id: "primary",
        candidateId: "user",
        kind: "primary_career" as const,
        name: "Primary",
        purpose: "Permanent career",
        displayPriority: 1,
        targetRoleFamilies: [],
        suitableRoleFamilies: [],
        prohibitedRoleFamilies: [],
        scoringPolicyVersion: "v2",
        active: true,
      },
    ];
    expect(() => selectCareerMode(modes, undefined)).toThrow(
      "selected explicitly",
    );
    expect(selectCareerMode(modes, "primary").id).toBe("primary");
  });

  it("creates the two approved, separate default career modes", () => {
    const modes = createDefaultCareerModes("user");
    expect(modes.map((mode) => mode.kind)).toEqual([
      "primary_career",
      "temporary_income",
    ]);
    expect(modes[0].targetRoleFamilies[0]).toEqual({
      roleFamily: "Frontend Engineer",
      priority: 1,
    });
    expect(modes[1].prohibitedRoleFamilies).toContain("Retail");
  });

  it("only makes confirmed required/prohibited preferences hard rules", () => {
    const preference: CareerPreference = {
      ...lifecycle,
      id: "preference",
      candidateId: "user",
      kind: "constraint",
      subject: "role_family",
      value: "retail",
      strength: "prohibited",
      reason: "The approved temporary mode excludes retail work.",
      exceptions: [],
    };
    expect(isConfirmedHardPreference(preference)).toBe(true);
    expect(
      isConfirmedHardPreference({ ...preference, status: "proposed" }),
    ).toBe(false);
  });

  it("handles staleness according to the knowledge class", () => {
    const stale = {
      ...lifecycle,
      reviewAfter: "2026-07-01T00:00:00.000Z",
    };
    expect(knowledgeInfluence(stale, "permanent_evidence", now)).toBe(
      "active",
    );
    expect(knowledgeInfluence(stale, "slowly_changing", now)).toBe(
      "active_with_warning",
    );
    expect(knowledgeInfluence(stale, "critical_constraint", now)).toBe(
      "requires_confirmation",
    );
    expect(knowledgeInfluence(stale, "temporary_state", now)).toBe(
      "active_with_warning",
    );
  });

  it("selects confirmed mode/task policies in priority order", () => {
    const policies: DecisionPolicy[] = [
      policy("low", 10),
      policy("high", 90),
      { ...policy("other-mode", 100), careerModeId: "temporary" },
      { ...policy("proposed", 200), status: "proposed" },
    ];
    expect(
      selectApplicablePolicies({
        policies,
        task: "job_analysis",
        careerModeId: "primary",
        now,
      }).map((item) => item.id),
    ).toEqual(["low", "high"]);
  });

  it("reports equal-priority contradictory policies", () => {
    expect(
      detectPolicyConflicts([
        {
          ...policy("favour", 50),
          decisionKey: "company_stage",
          effect: "favour",
        },
        {
          ...policy("avoid", 50),
          decisionKey: "company_stage",
          effect: "avoid",
        },
      ]),
    ).toEqual([
      {
        decisionKey: "company_stage",
        priority: 50,
        policyIds: ["favour", "avoid"],
      },
    ]);
  });

  it("allows only confirmed evidence to support factual claims", () => {
    const records: EvidenceRecord[] = [
      evidence("confirmed", "confirmed"),
      evidence("proposed", "proposed"),
      evidence("stale", "stale"),
    ];
    expect(confirmedEvidence(records).map((item) => item.id)).toEqual([
      "confirmed",
    ]);
  });

  it("forces investigation when a critical constraint is stale", () => {
    const dimensions = Object.fromEntries(
      axes.map((axis) => [
        axis,
        dimension(axis, axis === "evidence_strength" ? 55 : 80),
      ]),
    ) as Record<AnalysisAxis, AnalysisAxisResult>;
    const result = decideModeAwareRecommendation({
      id: "analysis",
      candidateId: "user",
      jobId: "job",
      selectedCareerModeId: "primary",
      dimensions,
      blockers: [],
      uncertainties: [],
      staleCriticalConstraints: ["Visa status needs confirmation"],
      tradeOffs: [],
      createdAt: now.toISOString(),
    });
    expect(result.recommendation).toBe("investigate");
    expect(result.applicationPosture).toBe("ambitious");
  });
});

function policy(id: string, priority: number): DecisionPolicy {
  return {
    ...lifecycle,
    id,
    candidateId: "user",
    policyType: "career_tradeoff",
    rule: id,
    enforcement: "mixed",
    taskScopes: ["job_analysis"],
    careerModeId: "primary",
    priority,
    exceptions: [],
  };
}

function evidence(
  id: string,
  status: EvidenceRecord["status"],
): EvidenceRecord {
  return {
    ...lifecycle,
    status,
    id,
    candidateId: "user",
    evidenceType: "project",
    title: id,
    summary: id,
    documentIds: [],
    skillIds: [],
    technologies: [],
  };
}

const axes: AnalysisAxis[] = [
  "eligibility",
  "requirements_coverage",
  "evidence_strength",
  "career_direction_alignment",
  "personal_interest",
  "growth_opportunity",
  "application_competitiveness",
  "practical_attractiveness",
  "preference_alignment",
];

function dimension(axis: AnalysisAxis, score: number): AnalysisAxisResult {
  return {
    axis,
    score,
    confidence: 0.8,
    rationale: axis,
    citations: [],
  };
}
