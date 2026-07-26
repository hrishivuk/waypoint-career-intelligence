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
const [skills, competencies, evidence] = await Promise.all([
  client
    .from("skills")
    .select("name,aliases")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .order("name"),
  client
    .from("professional_competencies")
    .select("name,description")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .order("name"),
  client
    .from("evidence_records")
    .select("title,narrative")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .order("created_at"),
]);
for (const result of [skills, competencies, evidence]) {
  if (result.error) throw new Error(result.error.message);
}

const relevantPattern =
  /\b(ambigu|technical debt|codebase|legacy|refactor|maintain|existing|growth|problem.solv|debug|code review)\w*/i;
const result = {
  confirmedSkills: (skills.data ?? []).map((item) => ({
    name: item.name,
    aliases: item.aliases,
  })),
  confirmedCompetencies: (competencies.data ?? []).map((item) => item.name),
  relevantEvidence: (evidence.data ?? [])
    .filter((item) =>
      relevantPattern.test(`${item.title ?? ""} ${item.narrative ?? ""}`),
    )
    .map((item) => ({
      title: item.title,
      narrative:
        typeof item.narrative === "string"
          ? item.narrative.slice(0, 300)
          : null,
    })),
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
