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

function sourceBlockIds(text: string, maximumCharacters = 1200) {
  const ids: string[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    let localStart = 0;
    while (localStart < paragraph.length) {
      let localEnd = Math.min(paragraph.length, localStart + maximumCharacters);
      if (localEnd < paragraph.length) {
        const boundary = Math.max(
          paragraph.lastIndexOf("\n", localEnd),
          paragraph.lastIndexOf(". ", localEnd),
          paragraph.lastIndexOf("; ", localEnd),
          paragraph.lastIndexOf(" ", localEnd),
        );
        if (boundary > localStart + Math.floor(maximumCharacters * 0.5)) {
          localEnd = boundary + (paragraph[boundary] === "." ? 1 : 0);
        }
      }
      if (paragraph.slice(localStart, localEnd).trim()) {
        ids.push(`block-${String(ids.length + 1).padStart(4, "0")}`);
      }
      localStart = Math.max(localEnd, localStart + 1);
    }
  }
  return ids;
}

async function main() {
  const [
    profile,
    imports,
    candidates,
    legacyFacts,
    legacySkills,
    legacyCompetencies,
  ] = await Promise.all([
    client
      .from("master_profile_records")
      .select(
        "id,record_type,canonical_key,title,statement,structured_data,confidence,status,source_import_id,source_candidate_id,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("record_type")
      .order("title"),
    client
      .from("career_narrative_imports")
      .select("id,status,source_text,created_at,activated_at,model_metadata")
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("career_narrative_candidates")
      .select(
        "id,import_id,record_type,title,statement,structured_data,source_block_id,confidence,decision,reconciliation,target_record_id,canonical_key",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("career_profile_facts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("skills")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("professional_competencies")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

for (const result of [
  profile,
  imports,
  candidates,
  legacyFacts,
  legacySkills,
  legacyCompetencies,
]) {
  if (result.error) throw new Error(result.error.message);
}

const records = profile.data ?? [];
const staged = candidates.data ?? [];
const groupCounts = (values: string[]) =>
  Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((value) => [value, values.filter((item) => item === value).length]),
  );
const normalizedTitle = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const titleGroups = new Map<string, typeof records>();
for (const record of records) {
  const keyValue = `${record.record_type}:${normalizedTitle(record.title)}`;
  titleGroups.set(keyValue, [...(titleGroups.get(keyValue) ?? []), record]);
}

const sourceCandidateIds = new Set(staged.map((item) => item.id));
const importIds = new Set((imports.data ?? []).map((item) => item.id));
const levels = ["learning", "basic", "working", "strong", "expert"];

const result = {
  summary: {
    profileRecords: records.length,
    profileByType: groupCounts(records.map((item) => item.record_type)),
    profileByStatus: groupCounts(records.map((item) => item.status)),
    narrativeImports: imports.data?.length ?? 0,
    importsByStatus: groupCounts(
      (imports.data ?? []).map((item) => item.status),
    ),
    candidates: staged.length,
    candidatesByDecision: groupCounts(staged.map((item) => item.decision)),
    candidatesByReconciliation: groupCounts(
      staged.map((item) => item.reconciliation),
    ),
    decisionByReconciliation: Object.fromEntries(
      [...new Set(staged.map((item) => item.reconciliation))]
        .sort()
        .map((reconciliation) => [
          reconciliation,
          groupCounts(
            staged
              .filter((item) => item.reconciliation === reconciliation)
              .map((item) => item.decision),
          ),
        ]),
    ),
    legacy: {
      careerProfileFacts: legacyFacts.count ?? 0,
      skills: legacySkills.count ?? 0,
      professionalCompetencies: legacyCompetencies.count ?? 0,
    },
  },
  integrity: {
    duplicateCanonicalKeys: Object.entries(
      groupCounts(records.map((item) => item.canonical_key)),
    ).filter(([, count]) => count > 1),
    duplicateTypeTitles: [...titleGroups.entries()]
      .filter(([, items]) => items.length > 1)
      .map(([identity, items]) => ({
        identity,
        ids: items.map((item) => item.id),
      })),
    brokenSourceCandidates: records
      .filter((item) => !sourceCandidateIds.has(item.source_candidate_id))
      .map((item) => item.id),
    brokenSourceImports: records
      .filter((item) => !importIds.has(item.source_import_id))
      .map((item) => item.id),
    updateCandidatesWithoutTarget: staged
      .filter(
        (item) =>
          ["update_existing", "possible_conflict"].includes(
            item.reconciliation,
          ) && !item.target_record_id,
      )
      .map((item) => item.id),
    invalidSkillLevels: records
      .filter(
        (item) =>
          item.record_type === "skill" &&
          item.structured_data?.proficiency != null &&
          !levels.includes(String(item.structured_data.proficiency)),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        proficiency: item.structured_data?.proficiency,
      })),
    skillsWithoutLevel: records
      .filter(
        (item) =>
          item.record_type === "skill" &&
          item.structured_data?.proficiency == null,
      )
      .map((item) => item.title),
    lowConfidence: records
      .filter((item) => Number(item.confidence) < 0.7)
      .map((item) => ({
        id: item.id,
        title: item.title,
        confidence: item.confidence,
      })),
    unresolvedCandidates: staged
      .filter((item) => item.decision === "pending")
      .map((item) => ({
        id: item.id,
        title: item.title,
        reconciliation: item.reconciliation,
      })),
    narrativeCoverage: (imports.data ?? []).map((item) => {
      if (
        item.model_metadata &&
        typeof item.model_metadata === "object" &&
        !Array.isArray(item.model_metadata) &&
        "repairVersion" in item.model_metadata
      ) {
        return {
          importId: item.id,
          status: item.status,
          repairImport: true,
          sourceBlocks: 0,
          coveredBlocks: 0,
          uncoveredBlockIds: [],
          candidates: staged.filter(
            (candidate) => candidate.import_id === item.id,
          ).length,
        };
      }
      const blocks = sourceBlockIds(item.source_text);
      const candidatesForImport = staged.filter(
        (candidate) => candidate.import_id === item.id,
      );
      const covered = new Set(
        [
          ...candidatesForImport.map(
            (candidate) => candidate.source_block_id,
          ),
          ...staged
            .filter((candidate) =>
              String(candidate.source_block_id).startsWith(`${item.id}:`),
            )
            .map((candidate) =>
              String(candidate.source_block_id).slice(item.id.length + 1),
            ),
        ],
      );
      return {
        importId: item.id,
        status: item.status,
        sourceBlocks: blocks.length,
        coveredBlocks: blocks.filter((blockId) => covered.has(blockId)).length,
        uncoveredBlockIds: blocks.filter(
          (blockId) => !covered.has(blockId),
        ),
        candidates: candidatesForImport.length,
      };
    }),
  },
  records: records.map((item) => ({
    id: item.id,
    type: item.record_type,
    key: item.canonical_key,
    title: item.title,
    statement: item.statement,
    proficiency: item.structured_data?.proficiency ?? null,
    proficiencyBasis: item.structured_data?.proficiencyBasis ?? null,
    strength: item.structured_data?.strength ?? null,
    confidence: item.confidence,
  })),
};

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main();
