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

async function main() {
  const [skills, assessments] = await Promise.all([
    client
      .from("skills")
      .select("id,name")
      .eq("user_id", userId)
      .eq("status", "confirmed"),
    client
      .from("capability_assessments")
      .select("skill_id,proficiency_level,current_level,context")
      .eq("user_id", userId)
      .eq("status", "confirmed"),
  ]);
  if (skills.error) throw skills.error;
  if (assessments.error) throw assessments.error;
  const bySkill = new Map(
    (assessments.data ?? []).map((assessment) => [
      assessment.skill_id,
      assessment,
    ]),
  );
  process.stdout.write(
    `${JSON.stringify(
      (skills.data ?? [])
        .map((skill) => ({
          name: skill.name,
          level:
            bySkill.get(skill.id)?.proficiency_level ??
            bySkill.get(skill.id)?.current_level ??
            null,
          context: bySkill.get(skill.id)?.context ?? null,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      null,
      2,
    )}\n`,
  );
}

void main();
