import { describe, expect, it } from "vitest";

import {
  createDefaultCareerModes,
  detectPolicyConflicts,
  evaluatePolicyEffects,
  knowledgeInfluence,
  preciseDateSchema,
  reconcileSeededCareerModes,
  selectCareerMode,
  validateCvPolicyReferences,
  validateHandoverRecordsV11,
  validatePreferenceValue,
  validateTemporaryState,
  type CvArtifact,
  type DecisionPolicy,
  type TemporaryCareerState,
} from ".";

const now = new Date("2026-07-24T12:00:00.000Z");
const lifecycle = {
  status: "confirmed" as const,
  confidence: 1,
  sources: [],
  tags: [],
};

describe("Waypoint handover v1.1", () => {
  it.each([
    [{ value: "2025", precision: "year" }, true],
    [{ value: "2025-05", precision: "month" }, true],
    [{ value: "2025-05-22", precision: "day" }, true],
    [{ value: "2025-01-01", precision: "year" }, false],
    [{ value: "2025-05-01", precision: "month" }, false],
    [{ value: "2025-02-30", precision: "day" }, false],
  ])("validates source date precision %#", (date, expected) => {
    expect(preciseDateSchema.safeParse(date).success).toBe(expected);
  });

  it("rejects v1-style normalized source dates in v1.1 records", () => {
    const result = validateHandoverRecordsV11([
      {
        ...handoverBase("example-evidence"),
        type: "evidence",
        evidence_type: "employment",
        title: "Example",
        summary: "Example evidence",
        start_date: "2025-05-01",
      },
    ]);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("value and precision");
  });

  it("supports factual expiry and review-only temporary states", () => {
    expect(validateTemporaryState(state({ validUntil: "2026-08-01" }))).toEqual(
      [],
    );
    expect(validateTemporaryState(state({ reviewAfter: "2026-08-01" }))).toEqual(
      [],
    );
    expect(validateTemporaryState(state({}))).toEqual([
      "Temporary state requires validUntil or reviewAfter.",
    ]);
  });

  it("expires temporary state but keeps review-due state visible", () => {
    expect(
      knowledgeInfluence(
        state({ validUntil: "2026-07-01" }),
        "temporary_state",
        now,
      ),
    ).toBe("inactive");
    expect(
      knowledgeInfluence(
        state({ reviewAfter: "2026-07-01" }),
        "temporary_state",
        now,
      ),
    ).toBe("active_with_warning");
    expect(
      knowledgeInfluence(
        state({
          reviewAfter: "2026-07-01",
          criticality: "critical",
        }),
        "temporary_state",
        now,
      ),
    ).toBe("requires_confirmation");
  });

  it("accepts atomic and ordered preferences and rejects compound scalars", () => {
    expect(validatePreferenceValue("hybrid")).toEqual([]);
    expect(
      validatePreferenceValue({
        kind: "ordered",
        values: ["hybrid", "onsite", "remote"],
      }),
    ).toEqual([]);
    expect(validatePreferenceValue("hybrid, onsite, remote")[0]).toContain(
      "atomic",
    );

    const base = {
      ...handoverBase("work-setting"),
      type: "preference",
      subject: "work-setting",
      strength: "preferred",
      reason: "Explicit ranking",
    };
    expect(
      validateHandoverRecordsV11([
        { ...base, value: "hybrid" },
        {
          ...base,
          id: "work-setting-ranking",
          ordered_values: [
            { value: "hybrid", rank: 1 },
            { value: "onsite", rank: 2 },
            { value: "remote", rank: 3 },
          ],
        },
      ]).success,
    ).toBe(true);
    expect(
      validateHandoverRecordsV11([
        { ...base, value: "hybrid, onsite, remote" },
      ]).success,
    ).toBe(false);
  });

  it("evaluates structured blockers, investigations, and modifiers", () => {
    const effects = evaluatePolicyEffects([
      policy("blocked", "block"),
      policy("investigate", "require_investigation"),
      { ...policy("increase", "increase"), modifier: 12 },
      { ...policy("decrease", "decrease"), modifier: 5 },
    ]);
    expect(effects.blockers).toEqual(["blocked"]);
    expect(effects.investigations).toEqual(["investigate"]);
    expect(effects.modifiers).toEqual({ eligibility: 7 });
  });

  it("reports opposing structured effects at equal priority", () => {
    expect(
      detectPolicyConflicts([
        policy("prefer", "prefer"),
        policy("avoid", "avoid"),
      ])[0]?.policyIds,
    ).toEqual(["prefer", "avoid"]);
  });

  it("validates CV policy references", () => {
    const artifact: CvArtifact = {
      ...lifecycle,
      id: "frontend-cv",
      candidateId: "user",
      name: "Frontend CV",
      intendedRoleFamilies: ["Frontend Engineer"],
      sourceDocumentId: "document-1",
    };
    expect(
      validateCvPolicyReferences(
        [{ ...policy("known", "prefer"), cvArtifactIds: [artifact.id] }],
        [artifact],
      ),
    ).toEqual([]);
    expect(
      validateCvPolicyReferences(
        [{ ...policy("unknown", "prefer"), cvArtifactIds: ["missing-cv"] }],
        [artifact],
      )[0],
    ).toContain("unknown CV");
  });

  it("rejects unknown CV references in handover validation", () => {
    const result = validateHandoverRecordsV11([
      handoverPolicy({ cv_artifact_refs: ["missing-cv"] }),
    ]);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("unknown CV");
  });

  it("never lets proposed or stale critical eligibility establish truth", () => {
    expect(
      knowledgeInfluence(
        { ...lifecycle, status: "proposed", criticality: "critical" },
        "critical_constraint",
        now,
      ),
    ).toBe("inactive");
    expect(
      knowledgeInfluence(
        {
          ...lifecycle,
          criticality: "critical",
          reviewAfter: "2026-07-01",
        },
        "critical_constraint",
        now,
      ),
    ).toBe("requires_confirmation");
    expect(
      knowledgeInfluence(
        { ...lifecycle, criticality: "critical" },
        "critical_constraint",
        now,
      ),
    ).toBe("requires_confirmation");
  });

  it("keeps proposed modes inactive and reconciles seeded modes by stable ID", () => {
    const seeded = createDefaultCareerModes("user");
    const proposedDuplicate = {
      ...seeded[0],
      status: "proposed" as const,
      name: "Untrusted replacement",
    };
    expect(() => selectCareerMode([proposedDuplicate], proposedDuplicate.id)).toThrow(
      "not active",
    );
    const reconciled = reconcileSeededCareerModes(seeded, [proposedDuplicate]);
    expect(reconciled).toHaveLength(2);
    expect(reconciled[0].name).toBe("Primary career");
  });

  it("preserves approved role wording and primary-mode boundaries", () => {
    const [primary, temporary] = createDefaultCareerModes("user");
    expect(primary.prohibitedRoleFamilies).toEqual([]);
    expect(temporary.suitableRoleFamilies).toContain(
      "Non-sales Customer Success",
    );
    expect(temporary.suitableRoleFamilies).not.toContain("Customer Success");
  });
});

function state(
  fields: Partial<TemporaryCareerState>,
): TemporaryCareerState {
  return {
    ...lifecycle,
    id: "state",
    candidateId: "user",
    stateType: "availability",
    value: "Available",
    ...fields,
  };
}

function policy(id: string, effect: DecisionPolicy["effect"]): DecisionPolicy {
  return {
    ...lifecycle,
    id,
    candidateId: "user",
    policyType: "eligibility",
    rule: id,
    enforcement: "mixed",
    taskScopes: ["job_analysis"],
    priority: 10,
    exceptions: [],
    decisionKey: "eligibility",
    effect,
  };
}

function handoverPolicy(extra: Record<string, unknown>) {
  return {
    type: "decision_policy",
    id: "cv-selection-policy",
    status: "proposed",
    confidence: "high",
    provenance: {
      source_type: "chatgpt_handover",
      source_ref: "career conversation",
      basis: "explicitly_stated",
    },
    policy_type: "cv-selection",
    rule: "Use the referenced CV.",
    enforcement: "mixed",
    task_scopes: ["cv_selection"],
    priority: 10,
    decision_key: "cv_selection",
    effect: "prefer",
    ...extra,
  };
}

function handoverBase(id: string) {
  return {
    id,
    status: "proposed",
    confidence: "high",
    provenance: {
      source_type: "chatgpt_handover",
      source_ref: "career conversation",
      basis: "explicitly_stated",
    },
  };
}
