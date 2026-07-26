import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

const assessmentSchema = z.object({
  schema_version: z.literal("waypoint-skill-levels-v1"),
  assessment_basis: z.string().min(1),
  assessments: z.array(
    z.object({
      skill: z.string().min(1),
      level: z.enum([
        "learning",
        "basic",
        "working",
        "strong",
        "expert",
        "not_assessed",
      ]),
      rationale: z.string().min(1),
      evidence_basis: z.array(z.string().min(1)),
      assessment_confidence: z.enum(["low", "medium", "high"]),
      needs_user_confirmation: z.boolean(),
    }),
  ),
});

const planSchema = z.object({
  schema_version: z.literal("waypoint-skill-taxonomy-plan-v2"),
  status: z.literal("proposed"),
  merges: z.array(
    z.object({
      canonical_name: z.string(),
      members: z.array(z.string()),
      aliases: z.array(z.string()),
    }),
  ),
  renames: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      preserve_as_alias: z.boolean(),
    }),
  ),
  reclassifications: z.array(
    z.object({
      name: z.string(),
      destination: z.string().optional(),
      canonical_name: z.string().optional(),
      category: z.string().optional(),
      action: z.string().optional(),
    }),
  ),
  blocked_assessments: z.array(
    z.object({
      skill: z.string(),
      proposed_level: z.string(),
      reason: z.string(),
    }),
  ),
  insufficient_evidence: z.array(z.string()),
});

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error(
    "Usage: npm run plan:skill-taxonomy -- <skill-assessment-json>",
  );
}

const projectRoot = resolve(import.meta.dirname, "..");
const [sourceText, planText] = await Promise.all([
  readFile(resolve(sourcePath), "utf8"),
  readFile(
    resolve(projectRoot, "docs/architecture/skill-taxonomy-v2-plan.json"),
    "utf8",
  ),
]);
const source = assessmentSchema.parse(JSON.parse(sourceText));
const plan = planSchema.parse(JSON.parse(planText));
const names = source.assessments.map((assessment) => assessment.skill);
const duplicateNames = names.filter(
  (name, index) => names.indexOf(name) !== index,
);
if (duplicateNames.length) {
  throw new Error(`Duplicate assessments: ${duplicateNames.join(", ")}`);
}

const mergeMemberToCanonical = new Map(
  plan.merges.flatMap((merge) =>
    merge.members.map((member) => [member, merge.canonical_name] as const),
  ),
);
const renameToCanonical = new Map(
  plan.renames.map((rename) => [rename.from, rename.to] as const),
);
const competencyNames = new Map(
  plan.reclassifications
    .filter((item) => item.destination === "professional_competency")
    .map((item) => [item.name, item.canonical_name ?? item.name] as const),
);
const blockedNames = new Set(
  plan.blocked_assessments.map((item) => item.skill),
);

const grouped = new Map<string, typeof source.assessments>();
for (const assessment of source.assessments) {
  const canonicalName =
    mergeMemberToCanonical.get(assessment.skill) ??
    renameToCanonical.get(assessment.skill) ??
    competencyNames.get(assessment.skill) ??
    assessment.skill;
  const entries = grouped.get(canonicalName) ?? [];
  entries.push(assessment);
  grouped.set(canonicalName, entries);
}

const transformed = [...grouped.entries()].map(([canonicalName, entries]) => {
  const distinctLevels = [...new Set(entries.map((entry) => entry.level))];
  const blocked =
    entries.some((entry) => blockedNames.has(entry.skill)) ||
    distinctLevels.length > 1 ||
    entries.some((entry) => entry.needs_user_confirmation);
  return {
    canonical_name: canonicalName,
    destination: entries.some((entry) => competencyNames.has(entry.skill))
      ? "professional_competency"
      : "skill",
    source_skills: entries.map((entry) => entry.skill),
    proposed_level:
      distinctLevels.length === 1 ? distinctLevels[0] : null,
    status: blocked ? "requires_review" : "ready",
    blockers: [
      ...(entries.some((entry) => blockedNames.has(entry.skill))
        ? ["explicit_assessment_conflict"]
        : []),
      ...(distinctLevels.length > 1 ? ["merged_levels_disagree"] : []),
      ...(entries.some((entry) => entry.needs_user_confirmation)
        ? ["user_confirmation_required"]
        : []),
    ],
  };
});

const report = {
  schema_version: "waypoint-skill-taxonomy-dry-run-v2",
  source_assessments: source.assessments.length,
  unique_source_skills: new Set(names).size,
  canonical_records_after_mapping: transformed.length,
  proposed_skills: transformed.filter((item) => item.destination === "skill")
    .length,
  proposed_competencies: transformed.filter(
    (item) => item.destination === "professional_competency",
  ).length,
  ready_to_import: transformed.filter((item) => item.status === "ready").length,
  requires_review: transformed.filter(
    (item) => item.status === "requires_review",
  ).length,
  database_writes: 0,
  transformed,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

