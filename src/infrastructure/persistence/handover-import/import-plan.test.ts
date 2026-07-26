import { describe, expect, it } from "vitest";

import { buildProposedHandoverImportPlan } from "./import-plan";

const shared = {
  status: "proposed",
  confidence: "high",
  criticality: "normal",
  provenance: {
    source_type: "chatgpt_handover",
    source_ref: "career handover",
    basis: "explicitly_stated",
  },
};

describe("proposed handover import plan", () => {
  it("reconciles a seeded mode without downgrading or activating it", () => {
    const plan = build([{
      ...shared,
      id: "primary-career",
      type: "career_mode",
      name: "Primary career",
      purpose: "Permanent career growth",
      priority: 1,
      active: true,
      target_role_families: [],
      prohibited_role_families: [],
    }]);

    expect(plan.operations[0]).toMatchObject({
      action: "reconcile_seeded_mode",
      row: { slug: "primary-career", status: "proposed", is_active: false },
    });
    expect(plan.persistable).toBe(false);
  });

  it("maps atomic and ordered preferences as proposed", () => {
    const plan = build([
      {
        ...shared,
        id: "pref-one",
        type: "preference",
        subject: "work arrangement",
        value: "hybrid",
        strength: "preferred",
        reason: "Collaboration",
      },
      {
        ...shared,
        id: "pref-two",
        type: "preference",
        subject: "company stage",
        ordered_values: [
          { value: "startup", rank: 1 },
          { value: "scale-up", rank: 2 },
        ],
        strength: "preferred",
        reason: "Ownership",
      },
    ]);

    expect(plan.operations.map((operation) => operation.row)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "hybrid", value_shape: "scalar" }),
        expect.objectContaining({
          value: [
            { value: "startup", rank: 1 },
            { value: "scale-up", rank: 2 },
          ],
          value_shape: "ordered",
        }),
      ]),
    );
    expect(plan.operations.every(({ row }) => row.status === "proposed")).toBe(true);
  });

  it("rejects unknown CV policy and source-document references", () => {
    const plan = build([
      {
        ...shared,
        id: "cv-frontend",
        type: "cv_artifact",
        name: "Frontend CV",
        intended_role_families: ["Frontend Engineer"],
        source_document_ref: "missing.pdf",
      },
      {
        ...shared,
        id: "policy-cv",
        type: "decision_policy",
        policy_type: "cv-selection",
        rule: "Use a known CV",
        enforcement: "hard_rule",
        task_scopes: ["cv_selection"],
        priority: 1,
        decision_key: "cv",
        effect: "prefer",
        cv_artifact_refs: ["cv-unknown"],
      },
    ]);

    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown_document_reference" }),
        expect.objectContaining({ code: "unknown_cv_reference" }),
      ]),
    );
    expect(plan.operations.some(({ table }) => table === "cv_artifacts")).toBe(false);
  });

  it("never accepts a confirmed imported record", () => {
    const plan = build([{
      ...shared,
      id: "skill-react",
      type: "skill",
      status: "confirmed",
      name: "React",
      category: "frontend",
    }]);

    expect(plan.operations).toHaveLength(0);
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "non_proposed_record" }),
      ]),
    );
  });
});

function build(records: Array<Record<string, unknown>>) {
  return buildProposedHandoverImportPlan({
    candidateId: "00000000-0000-4000-8000-000000000001",
    sourceDocumentId: "00000000-0000-4000-8000-000000000002",
    records: records as never,
    documentIdsByReference: {},
    databaseIdFor: (recordId) =>
      `00000000-0000-4000-8000-${recordId.padEnd(12, "0").slice(0, 12)}`,
  });
}
