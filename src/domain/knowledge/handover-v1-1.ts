import { z } from "zod";

const preciseDateSchema = z
  .object({
    value: z.string(),
    precision: z.enum(["year", "month", "day"]),
  })
  .strict()
  .superRefine((date, context) => {
    const patterns = {
      year: /^\d{4}$/,
      month: /^\d{4}-(0[1-9]|1[0-2])$/,
      day: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    };
    if (!patterns[date.precision].test(date.value)) {
      context.addIssue({
        code: "custom",
        message: `Date value does not match ${date.precision} precision.`,
      });
      return;
    }
    if (date.precision === "day") {
      const parsed = new Date(`${date.value}T00:00:00.000Z`);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date.value
      ) {
        context.addIssue({ code: "custom", message: "Date is not valid." });
      }
    }
  });

const shared = {
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.literal("proposed"),
  confidence: z.enum(["low", "medium", "high"]),
  provenance: z
    .object({
      source_type: z.enum([
        "chatgpt_handover",
        "chat",
        "cv",
        "portfolio",
        "user_statement",
        "other",
      ]),
      source_ref: z.string().min(1),
      basis: z.enum(["explicitly_stated", "inferred", "documented", "mixed"]),
    })
    .strict(),
  valid_from: preciseDateSchema.optional(),
  valid_until: preciseDateSchema.optional(),
  last_confirmed_at: preciseDateSchema.optional(),
  review_after: preciseDateSchema.optional(),
  criticality: z.enum(["normal", "important", "critical"]).default("normal"),
  mode: z.enum(["primary-career", "temporary-income"]).optional(),
  tags: z.array(z.string()).optional(),
};

const scalarPreference = z.string().min(1).refine(
  (value) => !/[,;/]|\bthen\b/i.test(value),
  "Scalar preference values must be atomic; use an ordered value.",
);
const orderedPreference = z
  .array(
    z
      .object({
        value: scalarPreference,
        rank: z.number().int().positive(),
      })
      .strict(),
  )
  .min(2)
  .superRefine((items, context) => {
    if (new Set(items.map((item) => item.value)).size !== items.length) {
      context.addIssue({
        code: "custom",
        message: "Ordered preference values must be unique.",
      });
    }
    if (items.some((item, index) => item.rank !== index + 1)) {
      context.addIssue({
        code: "custom",
        message: "Ordered preference ranks must be consecutive from 1.",
      });
    }
  });

const preferenceSchema = z
  .object({
    ...shared,
    type: z.literal("preference"),
    subject: z.string().min(1),
    value: scalarPreference.optional(),
    ordered_values: orderedPreference.optional(),
    strength: z.enum([
      "required",
      "strongly_preferred",
      "preferred",
      "neutral",
      "undesirable",
      "prohibited",
    ]),
    reason: z.string().min(1),
    exceptions: z.array(z.string()).optional(),
  })
  .strict()
  .refine(
    (preference) =>
      (preference.value === undefined) !==
      (preference.ordered_values === undefined),
    "Preference requires exactly one of value or ordered_values.",
  );

const temporaryStateSchema = z
  .object({
    ...shared,
    type: z.literal("temporary_state"),
    state_type: z.enum([
      "availability",
      "job_search_urgency",
      "active_learning_focus",
      "interview_confidence",
      "portfolio_readiness",
      "target_location",
      "cv_status",
      "other",
    ]),
    value: z.string().min(1),
    reason: z.string().optional(),
  })
  .strict()
  .refine(
    (state) => state.valid_until !== undefined || state.review_after !== undefined,
    "Temporary state requires valid_until or review_after.",
  );

const decisionPolicySchema = z
  .object({
    ...shared,
    type: z.literal("decision_policy"),
    policy_type: z.string().min(1),
    rule: z.string().min(1),
    enforcement: z.enum([
      "hard_rule",
      "score_modifier",
      "model_guidance",
      "mixed",
    ]),
    task_scopes: z.array(z.string()).min(1),
    priority: z.number().int().positive(),
    exceptions: z.array(z.string()).optional(),
    decision_key: z.string().min(1),
    operator: z
      .enum([
        "equals",
        "not_equals",
        "contains",
        "not_contains",
        "exists",
        "missing",
        "stale",
        "matches",
      ])
      .optional(),
    effect: z.enum([
      "block",
      "require_investigation",
      "increase",
      "decrease",
      "prefer",
      "avoid",
      "guidance_only",
    ]),
    condition_value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    modifier: z.number().finite().min(-100).max(100).optional(),
    cv_artifact_refs: z.array(z.string()).min(1).optional(),
  })
  .strict()
  .superRefine((policy, context) => {
    const isModifier = policy.effect === "increase" || policy.effect === "decrease";
    if (isModifier !== (policy.modifier !== undefined)) {
      context.addIssue({
        code: "custom",
        message: "modifier is required only for increase or decrease effects.",
      });
    }
    if (
      policy.operator &&
      !["exists", "missing", "stale"].includes(policy.operator) &&
      policy.condition_value === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "operator requires condition_value.",
      });
    }
    if (!policy.operator && policy.condition_value !== undefined) {
      context.addIssue({
        code: "custom",
        message: "condition_value requires operator.",
      });
    }
    if (
      ["block", "require_investigation"].includes(policy.effect) &&
      !["hard_rule", "mixed"].includes(policy.enforcement)
    ) {
      context.addIssue({
        code: "custom",
        message: `${policy.effect} requires hard_rule or mixed enforcement.`,
      });
    }
    if (
      policy.effect === "guidance_only" &&
      !["model_guidance", "mixed"].includes(policy.enforcement)
    ) {
      context.addIssue({
        code: "custom",
        message: "guidance_only requires model_guidance or mixed enforcement.",
      });
    }
  });

const cvArtifactSchema = z
  .object({
    ...shared,
    type: z.literal("cv_artifact"),
    name: z.string().min(1),
    intended_role_families: z.array(z.string()).min(1),
    source_document_ref: z.string().min(1),
    revision: z.string().optional(),
    emphasis: z.string().optional(),
    supersedes: z.string().optional(),
    last_reviewed_at: preciseDateSchema.optional(),
  })
  .strict();

const stableFactSchema = z
  .object({
    ...shared,
    type: z.literal("stable_fact"),
    category: z.enum([
      "education",
      "employment",
      "eligibility",
      "career_goal",
      "interest",
      "technology",
      "other",
    ]),
    statement: z.string().min(1),
    evidence_refs: z.array(z.string()).optional(),
  })
  .strict();

const careerModeSchema = z
  .object({
    ...shared,
    type: z.literal("career_mode"),
    name: z.string().min(1),
    purpose: z.string().min(1),
    priority: z.number().int().positive(),
    target_role_families: z
      .array(
        z
          .object({
            role: z.string().min(1),
            priority: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
    prohibited_role_families: z.array(z.string().min(1)),
    active: z.boolean().optional(),
    start_date: preciseDateSchema.optional(),
    end_date: preciseDateSchema.optional(),
  })
  .strict();

const workingStyleSchema = z
  .object({
    ...shared,
    type: z.literal("working_style"),
    trait: z.string().min(1),
    description: z.string().min(1),
    career_relevance: z.string().min(1).optional(),
    exceptions: z.array(z.string()).optional(),
  })
  .strict();

const skillSchema = z
  .object({
    ...shared,
    type: z.literal("skill"),
    name: z.string().min(1),
    category: z.string().min(1),
    aliases: z.array(z.string()).optional(),
  })
  .strict();

const capabilityAssessmentSchema = z
  .object({
    ...shared,
    type: z.literal("capability_assessment"),
    skill_ref: z.string().min(1),
    current_level: z.enum([
      "awareness",
      "beginner",
      "working",
      "proficient",
      "advanced",
      "expert",
    ]),
    assessment_date: preciseDateSchema,
    context: z.string().min(1),
    target_level: z
      .enum([
        "awareness",
        "beginner",
        "working",
        "proficient",
        "advanced",
        "expert",
      ])
      .optional(),
    evidence_refs: z.array(z.string()).optional(),
    development_objective: z.string().min(1).optional(),
  })
  .strict();

const evidenceSchema = z
  .object({
    ...shared,
    type: z.literal("evidence"),
    evidence_type: z.enum([
      "employment",
      "project",
      "education",
      "achievement",
      "responsibility",
      "deliverable",
      "outcome",
      "technology",
      "research",
      "design_work",
    ]),
    title: z.string().min(1),
    summary: z.string().min(1),
    organisation: z.string().min(1).optional(),
    start_date: preciseDateSchema.optional(),
    end_date: preciseDateSchema.optional(),
    outcome: z.string().min(1).optional(),
    technologies: z.array(z.string()).optional(),
    parent_ref: z.string().min(1).optional(),
    source_document_ref: z.string().min(1).optional(),
  })
  .strict();

const historicalObservationSchema = z
  .object({
    ...shared,
    type: z.literal("historical_observation"),
    observed_at: preciseDateSchema,
    observation: z.string().min(1),
    decision: z.string().min(1).optional(),
    outcome: z.string().min(1).optional(),
    related_refs: z.array(z.string()).optional(),
  })
  .strict();

const uncertaintySchema = z
  .object({
    ...shared,
    type: z.literal("uncertainty"),
    topic: z.string().min(1),
    description: z.string().min(1),
    resolution_needed: z.string().min(1),
    contradicts: z.array(z.string()).optional(),
    candidate_values: z.array(z.string()).optional(),
  })
  .strict();

export const handoverRecordV11Schema = z.union([
  stableFactSchema,
  careerModeSchema,
  preferenceSchema,
  temporaryStateSchema,
  decisionPolicySchema,
  cvArtifactSchema,
  workingStyleSchema,
  skillSchema,
  capabilityAssessmentSchema,
  evidenceSchema,
  historicalObservationSchema,
  uncertaintySchema,
]);

export interface HandoverValidationResult {
  success: boolean;
  errors: string[];
}

export function validateHandoverRecordsV11(
  input: unknown[],
): HandoverValidationResult {
  const errors: string[] = [];
  const sourceDateFields = [
    "start_date",
    "end_date",
    "observed_at",
    "assessment_date",
    "last_reviewed_at",
    "valid_from",
    "valid_until",
    "last_confirmed_at",
    "review_after",
  ];
  const records = input.flatMap((record, index) => {
    if (record && typeof record === "object") {
      const candidate = record as Record<string, unknown>;
      for (const field of sourceDateFields) {
        if (
          candidate[field] !== undefined &&
          !preciseDateSchema.safeParse(candidate[field]).success
        ) {
          errors.push(
            `Record ${index}: ${field}: v1.1 source dates require value and precision.`,
          );
        }
      }
    }
    const result = handoverRecordV11Schema.safeParse(record);
    if (!result.success) {
      errors.push(
        ...result.error.issues.map(
          (issue) => `Record ${index}: ${issue.path.join(".")}: ${issue.message}`,
        ),
      );
      return [];
    }
    return [result.data];
  });

  const ids = new Set(records.map((record) => record.id));
  if (ids.size !== records.length) errors.push("Record IDs must be unique.");

  const artifacts = new Set(
    records
      .filter((record) => record.type === "cv_artifact")
      .map((record) => record.id),
  );
  for (const record of records) {
    if (record.type === "decision_policy" && record.cv_artifact_refs) {
      for (const reference of record.cv_artifact_refs) {
        if (!artifacts.has(reference)) {
          errors.push(
            `Policy ${record.id} references unknown CV ${reference}.`,
          );
        }
      }
    }
    if (
      record.type === "cv_artifact" &&
      record.supersedes &&
      !artifacts.has(record.supersedes)
    ) {
      errors.push(
        `CV ${record.id} supersedes unknown CV ${record.supersedes}.`,
      );
    }
  }
  return { success: errors.length === 0, errors };
}

export { preciseDateSchema };
