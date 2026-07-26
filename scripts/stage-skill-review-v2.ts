import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

loadEnvConfig(process.cwd());

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Usage: npm run stage:skill-review -- <assessment-json>");
}
const assessmentSchema = z.object({
  schema_version: z.literal("waypoint-skill-levels-v1"),
  assessments: z.array(
    z.object({
      skill: z.string(),
      level: z.enum([
        "learning",
        "basic",
        "working",
        "strong",
        "expert",
        "not_assessed",
      ]),
      rationale: z.string(),
      evidence_basis: z.array(z.string()),
      assessment_confidence: z.enum(["low", "medium", "high"]),
      needs_user_confirmation: z.boolean(),
    }),
  ),
});
const planSchema = z.object({
  merges: z.array(z.object({
    canonical_name: z.string(),
    members: z.array(z.string()),
  })),
  renames: z.array(z.object({ from: z.string(), to: z.string() })),
  reclassifications: z.array(z.object({
    name: z.string(),
    destination: z.string().optional(),
    canonical_name: z.string().optional(),
  })),
  blocked_assessments: z.array(z.object({ skill: z.string() })),
});

const absolutePath = resolve(sourcePath);
const sourceText = await readFile(absolutePath, "utf8");
const source = assessmentSchema.parse(JSON.parse(sourceText));
const plan = planSchema.parse(
  JSON.parse(
    await readFile(
      resolve("docs/architecture/skill-taxonomy-v2-plan.json"),
      "utf8",
    ),
  ),
);
const memberMap = new Map(
  plan.merges.flatMap((merge) =>
    merge.members.map((member) => [member, merge.canonical_name] as const),
  ),
);
const renameMap = new Map(
  plan.renames.map((rename) => [rename.from, rename.to] as const),
);
const competencyMap = new Map(
  plan.reclassifications
    .filter((item) => item.destination === "professional_competency")
    .map((item) => [item.name, item.canonical_name ?? item.name] as const),
);
const blocked = new Set(
  plan.blocked_assessments.map((item) => item.skill),
);
const grouped = new Map<string, typeof source.assessments>();
for (const assessment of source.assessments) {
  const canonical =
    memberMap.get(assessment.skill) ??
    renameMap.get(assessment.skill) ??
    competencyMap.get(assessment.skill) ??
    assessment.skill;
  grouped.set(canonical, [...(grouped.get(canonical) ?? []), assessment]);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId =
  process.env.PROTOTYPE_USER_ID ??
  "00000000-0000-4000-8000-000000000001";
if (!url || !key) throw new Error("Supabase is not configured.");
const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sourceHash = createHash("sha256").update(sourceText).digest("hex");
const batchResult = await client
  .from("skill_model_review_batches")
  .upsert(
    {
      user_id: userId,
      schema_version: source.schema_version,
      source_hash: sourceHash,
      source_name: basename(absolutePath),
    },
    { onConflict: "user_id,source_hash" },
  )
  .select("id")
  .single();
if (batchResult.error) throw new Error(batchResult.error.message);

const confidence = { low: 0.4, medium: 0.7, high: 0.95 } as const;
const rows = [...grouped.entries()].map(([canonical, entries]) => {
  const levels = [...new Set(entries.map((entry) => entry.level))];
  return {
    user_id: userId,
    batch_id: batchResult.data.id,
    canonical_name: canonical,
    destination: entries.some((entry) => competencyMap.has(entry.skill))
      ? "professional_competency"
      : "skill",
    source_skills: entries.map((entry) => entry.skill),
    proposed_level:
      levels.length === 1 && levels[0] !== "not_assessed" ? levels[0] : null,
    rationale: entries.map((entry) => entry.rationale).join("\n"),
    evidence_basis: [...new Set(entries.flatMap((entry) => entry.evidence_basis))],
    assessment_confidence: Math.min(
      ...entries.map((entry) => confidence[entry.assessment_confidence]),
    ),
    blocker_codes: [
      ...(entries.some((entry) => blocked.has(entry.skill))
        ? ["explicit_assessment_conflict"]
        : []),
      ...(levels.length > 1 ? ["merged_levels_disagree"] : []),
      ...(entries.some((entry) => entry.needs_user_confirmation)
        ? ["user_confirmation_required"]
        : []),
    ],
  };
});
const staged = await client
  .from("skill_model_review_items")
  .upsert(rows, { onConflict: "batch_id,canonical_name,destination" });
if (staged.error) throw new Error(staged.error.message);
process.stdout.write(
  `${JSON.stringify({ batchId: batchResult.data.id, staged: rows.length, writes: rows.length + 1 }, null, 2)}\n`,
);

