import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId =
  process.env.PROTOTYPE_USER_ID ??
  "00000000-0000-4000-8000-000000000001";

if (!url || !key) throw new Error("Supabase is not configured.");

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: batches, error: batchError } = await client
  .from("skill_model_review_batches")
  .select("id,status")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(1);
if (batchError) throw new Error(batchError.message);
const batch = batches?.[0];
if (!batch) throw new Error("No skill review batch was found.");

const { data: items, error: itemError } = await client
  .from("skill_model_review_items")
  .select(
    "id,canonical_name,destination,review_status,corrected_level,proposed_level,projected_record_id,projected_assessment_id,projected_at",
  )
  .eq("user_id", userId)
  .eq("batch_id", batch.id);
if (itemError) throw new Error(itemError.message);

const rows = items ?? [];
const pending = rows.filter((item) => item.review_status === "pending");
const accepted = rows.filter((item) => item.review_status !== "rejected");
const rejected = rows.filter((item) => item.review_status === "rejected");
const incomplete = accepted.filter(
  (item) =>
    !(item.corrected_level ?? item.proposed_level) ||
    !item.projected_record_id ||
    !item.projected_assessment_id ||
    !item.projected_at,
);
const incorrectlyProjected = rejected.filter(
  (item) => item.projected_record_id || item.projected_assessment_id,
);
const { data: activeSkills, error: activeSkillError } = await client
  .from("skills")
  .select("name")
  .eq("user_id", userId)
  .eq("status", "confirmed");
if (activeSkillError) throw new Error(activeSkillError.message);
const aiRelatedActiveSkills = (activeSkills ?? [])
  .map((skill) => skill.name)
  .filter((name) => /\b(ai|cursor|codex|claude|mcp|prompt)\b/i.test(name));

const result = {
  batchId: batch.id,
  batchStatus: batch.status,
  total: rows.length,
  accepted: accepted.length,
  rejected: rejected.length,
  skills: accepted.filter((item) => item.destination === "skill").length,
  competencies: accepted.filter(
    (item) => item.destination === "professional_competency",
  ).length,
  pending: pending.length,
  incomplete: incomplete.length,
  incorrectlyProjected: incorrectlyProjected.length,
  aiRelatedRecords: accepted
    .filter((item) =>
      /\b(ai|cursor|codex|claude|mcp|prompt)\b/i.test(item.canonical_name),
    )
    .map((item) => ({
      name: item.canonical_name,
      level: item.corrected_level ?? item.proposed_level,
    })),
  aiRelatedActiveSkills,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (
  batch.status !== "projected" ||
  pending.length ||
  incomplete.length ||
  incorrectlyProjected.length
) {
  throw new Error("Skill Model v2 projection validation failed.");
}
