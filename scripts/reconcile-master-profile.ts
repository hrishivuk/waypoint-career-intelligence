import { createHash } from "node:crypto";
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

const categoryCorrections = new Map([
  ["experience-coachcanvas-project", "project"],
  ["experience-flexsave-project", "project"],
  ["experience-waypoint-project", "project"],
  ["stable-fact-educational-background", "education"],
  ["stable-fact-msc-in-creative-digital-media-ux", "education"],
  ["stable-fact-location-and-work-eligibility", "eligibility"],
  ["stable-fact-industry-interests", "career_direction"],
  ["stable-fact-interest-development-in-ux-and-product-design", "career_direction"],
  ["stable-fact-professional-software-team-experience", "experience"],
]);

const levelAliases = new Map([
  ["accessibility", "accessibility wcag"],
  ["automated testing", "software testing"],
  ["backend development", "backend concepts"],
]);

const redundantCanonicalSkills = [
  "skill-accessibility-wcag",
  "skill-backend-concepts",
  "skill-software-testing",
];

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "record"
  );
}

async function main() {
  const [profileResult, skillsResult, assessmentsResult] = await Promise.all([
    client
      .from("master_profile_records")
      .select("id,record_type,canonical_key,title,statement,structured_data")
      .eq("user_id", userId)
      .eq("status", "confirmed"),
    client
      .from("skills")
      .select("id,name,description")
      .eq("user_id", userId)
      .eq("status", "confirmed"),
    client
      .from("capability_assessments")
      .select("skill_id,proficiency_level,current_level,context")
      .eq("user_id", userId)
      .eq("status", "confirmed"),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (skillsResult.error) throw skillsResult.error;
  if (assessmentsResult.error) throw assessmentsResult.error;
  const profile = profileResult.data ?? [];
  const assessments = new Map(
    (assessmentsResult.data ?? []).map((assessment) => [
      assessment.skill_id,
      assessment,
    ]),
  );
  const legacy = (skillsResult.data ?? []).map((skill) => ({
    ...skill,
    normalizedName: slug(skill.name).replaceAll("-", " "),
    level:
      assessments.get(skill.id)?.proficiency_level ??
      assessments.get(skill.id)?.current_level ??
      null,
    context: assessments.get(skill.id)?.context ?? skill.description ?? null,
  }));
  const legacyByName = new Map(
    legacy.map((skill) => [skill.normalizedName, skill]),
  );

  let categoryUpdates = 0;
  for (const record of profile) {
    const correctedType = categoryCorrections.get(record.canonical_key);
    if (!correctedType) continue;
    const { error } = await client
      .from("master_profile_records")
      .update({
        record_type: correctedType,
        canonical_key: `${slug(correctedType)}-${slug(record.title)}`,
      })
      .eq("id", record.id)
      .eq("user_id", userId);
    if (error) throw error;
    categoryUpdates += 1;
  }

  let levelUpdates = 0;
  for (const record of profile.filter(
    (candidate) => candidate.record_type === "skill",
  )) {
    const normalized = slug(record.title).replaceAll("-", " ");
    const legacyName = levelAliases.get(normalized) ?? normalized;
    const reviewed = legacyByName.get(legacyName);
    if (!reviewed?.level) continue;
    const structured =
      record.structured_data &&
      typeof record.structured_data === "object" &&
      !Array.isArray(record.structured_data)
        ? record.structured_data
        : {};
    const { error } = await client
      .from("master_profile_records")
      .update({
        structured_data: {
          ...structured,
          proficiency: reviewed.level,
          proficiencyBasis: reviewed.context,
          assessmentSource: "reviewed_skill_model_v2",
        },
      })
      .eq("id", record.id)
      .eq("user_id", userId);
    if (error) throw error;
    levelUpdates += 1;
  }

  const existingSkillNames = new Set(
    profile
      .filter((record) => record.record_type === "skill")
      .map((record) => slug(record.title).replaceAll("-", " ")),
  );
  const additions = legacy.filter(
    (skill) => skill.level && !existingSkillNames.has(skill.normalizedName),
  );
  let addedSkills = 0;
  if (additions.length) {
    const sourceText = additions
      .map(
        (skill) =>
          `${skill.name}: reviewed level ${skill.level}. ${skill.context ?? ""}`,
      )
      .join("\n\n");
    const sourceHash = createHash("sha256")
      .update(`master-profile-legacy-parity-v1\n${sourceText}`)
      .digest("hex");
    const { data: parityImport, error: importError } = await client
      .from("career_narrative_imports")
      .upsert(
        {
          user_id: userId,
          source_text: sourceText,
          source_hash: sourceHash,
          status: "staged",
          model_metadata: {
            migration: "master-profile-legacy-parity-v1",
            source: "reviewed_skill_model_v2",
          },
        },
        { onConflict: "user_id,source_hash", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (importError) throw importError;
    if (parityImport) {
      const { error: candidateError } = await client
        .from("career_narrative_candidates")
        .insert(
          additions.map((skill, index) => ({
            user_id: userId,
            import_id: parityImport.id,
            record_type: "skill",
            title: skill.name,
            statement:
              skill.context ??
              `Confirmed ${skill.name} capability from the reviewed skill model.`,
            structured_data: {
              proficiency: skill.level,
              proficiencyBasis: skill.context,
              assessmentSource: "reviewed_skill_model_v2",
              tags: [],
            },
            source_block_id: `legacy-skill-${String(index + 1).padStart(4, "0")}`,
            source_excerpt: `${skill.name}: ${skill.level}. ${skill.context ?? ""}`,
            confidence: 1,
            decision: "confirmed",
            reconciliation: "new",
            target_record_id: null,
            canonical_key: `skill-${slug(skill.name)}`,
            display_order: index,
          })),
        );
      if (candidateError) throw candidateError;
      const { data, error } = await client.rpc(
        "activate_career_narrative_import_v2",
        { p_user_id: userId, p_import_id: parityImport.id },
      );
      if (error) throw error;
      addedSkills = Number(data ?? 0);
    }
  }

  const { data: retired, error: retireError } = await client
    .from("master_profile_records")
    .update({ status: "rejected" })
    .eq("user_id", userId)
    .in("canonical_key", redundantCanonicalSkills)
    .select("id");
  if (retireError) throw retireError;

  process.stdout.write(
    `${JSON.stringify(
      {
        categoryUpdates,
        levelUpdates,
        addedSkills,
        semanticDuplicatesRetired: retired?.length ?? 0,
      },
      null,
      2,
    )}\n`,
  );
}

void main();
