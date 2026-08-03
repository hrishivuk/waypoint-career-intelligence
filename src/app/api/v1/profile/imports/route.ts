import { createHash } from "node:crypto";
import { z } from "zod";

import {
  createUserCareerAiGateway,
  safeAiErrorMessage,
  type CareerNarrativeExtraction,
} from "@/infrastructure/ai";
import {
  AccountProvisioningRequiredError,
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";
import { createDocumentTextBlocks } from "@/infrastructure/documents";
import { consumeUsage } from "@/infrastructure/usage/consume-usage";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  narrative: z.string().trim().min(100).max(12_000),
});

export async function GET() {
  try {
    const { actor, client } = await requireAuthenticatedContext();
    const { data: imports, error } = await client
      .from("career_narrative_imports")
      .select("id,status,created_at,activated_at")
      .eq("user_id", actor.userId)
      .eq("status", "staged")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const current = imports?.[0];
    if (!current) return Response.json({ currentImport: null, candidates: [] });
    const { data: candidates, error: candidateError } = await client
      .from("career_narrative_candidates")
      .select(
        "id,record_type,title,statement,structured_data,source_excerpt,confidence,decision,reconciliation,target_record_id,display_order",
      )
      .eq("user_id", actor.userId)
      .eq("import_id", current.id)
      .order("display_order");
    if (candidateError) throw candidateError;
    return Response.json({ currentImport: current, candidates });
  } catch (error) {
    return importError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            message:
              "Provide a career narrative between 100 and 12,000 characters.",
          },
        },
        { status: 400 },
      );
    }
    const { actor, client } = await requireAuthenticatedContext();
    const sourceHash = createHash("sha256")
      .update(parsed.data.narrative, "utf8")
      .digest("hex");
    const { data: previousImport, error: previousImportError } = await client
      .from("career_narrative_imports")
      .select("id,status,created_at,activated_at")
      .eq("user_id", actor.userId)
      .eq("source_hash", sourceHash)
      .maybeSingle();
    if (previousImportError) throw previousImportError;
    if (previousImport?.status === "staged") {
      const { data: existingCandidates, error: existingCandidateError } =
        await client
          .from("career_narrative_candidates")
          .select(
            "id,record_type,title,statement,structured_data,source_excerpt,confidence,decision,reconciliation,target_record_id,display_order",
          )
          .eq("user_id", actor.userId)
          .eq("import_id", previousImport.id)
          .order("display_order");
      if (existingCandidateError) throw existingCandidateError;
      return Response.json({
        currentImport: previousImport,
        candidates: existingCandidates ?? [],
      });
    }
    if (previousImport) {
      return Response.json(
        {
          error: {
            message:
              "This exact narrative has already been reviewed. Change or add new information before creating another review.",
          },
        },
        { status: 409 },
      );
    }
    await consumeUsage(actor.userId, "imports");
    const { data: existingProfile, error: profileError } = await client
      .from("master_profile_records")
      .select("id,record_type,title,statement,structured_data")
      .eq("user_id", actor.userId)
      .eq("status", "confirmed");
    if (profileError) throw profileError;
    const blocks = createDocumentTextBlocks(parsed.data.narrative);
    const existingRecords = selectRelevantProfileRecords(
      existingProfile ?? [],
      parsed.data.narrative,
    );
    const existingById = new Map(
      existingRecords.map((record) => [record.id, record]),
    );
    const existingByIdentity = new Map(
      existingRecords.map((record) => [
        `${record.recordType}:${normalizeKey(record.title)}`,
        record,
      ]),
    );
    const ai = await createUserCareerAiGateway(client, actor.userId);
    const extractedRecords: CareerNarrativeExtraction["records"] = [];
    const accountedBlockIds = new Set<string>();
    const warnings: string[] = [];
    const responseIds: string[] = [];
    const models = new Set<string>();
    const promptVersions = new Set<string>();
    const batches = chunk(blocks, 6);
    for (const batch of batches) {
      const result = await ai.extractCareerNarrative({
        blocks: batch.map(({ id, text }) => ({ id, text })),
        existingProfileRecords: existingRecords,
      });
      extractedRecords.push(...result.data.records);
      responseIds.push(result.responseId);
      models.add(result.model);
      promptVersions.add(result.promptVersion);
      warnings.push(...result.data.warnings);
      for (const id of [
        ...result.data.processedBlockIds,
        ...result.data.noClaimBlockIds,
        ...result.data.records.map((record) => record.blockId),
      ]) {
        if (batch.some((block) => block.id === id)) accountedBlockIds.add(id);
      }
    }
    const initiallyMissing = blocks.filter(
      (block) => !accountedBlockIds.has(block.id),
    );
    for (const block of initiallyMissing) {
      const retry = await ai.extractCareerNarrative({
        blocks: [{ id: block.id, text: block.text }],
        existingProfileRecords: existingRecords,
      });
      extractedRecords.push(...retry.data.records);
      responseIds.push(retry.responseId);
      models.add(retry.model);
      promptVersions.add(retry.promptVersion);
      warnings.push(...retry.data.warnings);
      const accounted = new Set([
        ...retry.data.processedBlockIds,
        ...retry.data.noClaimBlockIds,
        ...retry.data.records.map((record) => record.blockId),
      ]);
      if (accounted.has(block.id)) accountedBlockIds.add(block.id);
    }
    const blockById = new Map(blocks.map((block) => [block.id, block]));
    const records = extractedRecords.filter((record) =>
      blockById.has(record.blockId),
    );
    const missingBlockIds = blocks
      .filter((block) => !accountedBlockIds.has(block.id))
      .map((block) => block.id);
    if (missingBlockIds.length) {
      throw new Error(
        `The importer could not account for ${missingBlockIds.length} source section(s). Nothing was saved; try again shortly.`,
      );
    }
    if (!records.length) {
      throw new Error("No source-supported profile records were extracted.");
    }

    const unique = [
      ...new Map(
        records.map((record) => [
          `${record.recordType}:${record.title.toLowerCase()}:${record.statement.toLowerCase()}`,
          record,
        ]),
      ).values(),
    ];
    const candidatePayload = unique.map((record, index) => {
          const exactExisting = existingByIdentity.get(
            `${record.recordType}:${normalizeKey(record.title)}`,
          );
          const suggestedExisting = record.existingRecordId
            ? existingById.get(record.existingRecordId)
            : undefined;
          const target =
            exactExisting ??
            (suggestedExisting?.recordType === record.recordType
              ? suggestedExisting
              : undefined);
          const reconciliation = target
            ? record.reconciliation === "possible_conflict"
              ? "possible_conflict"
              : sameMeaning(target.statement, record.statement)
                ? "already_known"
                : "update_existing"
            : "new";
          return {
          record_type: record.recordType,
          title: record.title.trim(),
          statement: record.statement.trim(),
          structured_data: {
            proficiency: record.proficiency,
            proficiencyBasis: record.proficiencyBasis,
            organization: record.organization,
            role: record.role,
            startDate: record.startDate,
            endDate: record.endDate,
            isCurrent: record.isCurrent,
            strength: record.strength,
            tags: record.tags,
          },
          source_block_id: record.blockId,
          source_excerpt: blockById.get(record.blockId)?.text ?? "",
          confidence: record.confidence,
          decision: "pending",
          reconciliation,
          target_record_id: target?.id ?? null,
          canonical_key: `${normalizeKey(record.recordType)}-${normalizeKey(record.title)}`,
          display_order: index,
          };
        });
    const modelMetadata = {
      models: [...models],
      responseIds,
      promptVersions: [...promptVersions],
      warnings,
      coverage: {
        sourceBlocks: blocks.length,
        accountedBlocks: accountedBlockIds.size,
        noClaimBlocks:
          blocks.length - new Set(records.map((record) => record.blockId)).size,
      },
    };
    const { data: stagedImportId, error: stageError } = await client.rpc(
      "stage_career_narrative_import_v1",
      {
        p_user_id: actor.userId,
        p_source_text: parsed.data.narrative,
        p_source_hash: sourceHash,
        p_model_metadata: modelMetadata,
        p_candidates: candidatePayload,
      },
    );
    if (stageError?.code === "P0001") {
      return Response.json(
        {
          error: {
            message:
              "This exact narrative has already been reviewed. Change or add new information before creating another review.",
          },
        },
        { status: 409 },
      );
    }
    if (stageError || !stagedImportId) throw stageError ?? new Error("Narrative staging failed.");
    const [{ data: stagedImport, error: importError }, { data: candidates, error: candidateError }] =
      await Promise.all([
        client
          .from("career_narrative_imports")
          .select("id,status,created_at,activated_at")
          .eq("id", stagedImportId)
          .single(),
        client
          .from("career_narrative_candidates")
          .select(
            "id,record_type,title,statement,structured_data,source_excerpt,confidence,decision,reconciliation,target_record_id,display_order",
          )
          .eq("import_id", stagedImportId)
          .order("display_order"),
      ]);
    if (importError) throw importError;
    if (candidateError) throw candidateError;
    return Response.json(
      { currentImport: stagedImport, candidates },
      { status: 201 },
    );
  } catch (error) {
    return importError(error);
  }
}

function normalizeKey(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 150) || "record"
  );
}

function sameMeaning(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function selectRelevantProfileRecords(
  records: Array<{
    id: string;
    record_type: string;
    title: string;
    statement: string;
    structured_data: Record<string, unknown>;
  }>,
  narrative: string,
) {
  const terms = new Set(
    narrative
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((term) => term.length >= 3),
  );
  const ranked = records
    .map((record) => {
      const titleTerms = record.title
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter(Boolean);
      const statementTerms = record.statement
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter(Boolean);
      const score =
        titleTerms.filter((term) => terms.has(term)).length * 4 +
        statementTerms.filter((term) => terms.has(term)).length;
      return { record, score };
    })
    .sort((left, right) => right.score - left.score);

  const selected: Array<{
    id: string;
    recordType: string;
    title: string;
    statement: string;
    structuredData: Record<string, unknown>;
  }> = [];
  let characterBudget = 0;
  for (const { record, score } of ranked) {
    if (score === 0 && selected.length >= 20) continue;
    const compact = {
      id: record.id,
      recordType: record.record_type,
      title: record.title,
      statement: record.statement.slice(0, 240),
      structuredData: {},
    };
    const size = JSON.stringify(compact).length;
    if (characterBudget + size > 8_000) break;
    selected.push(compact);
    characterBudget += size;
  }
  return selected;
}

function importError(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json(
      { error: { message: "Authentication required." } },
      { status: 401 },
    );
  }
  if (error instanceof AccountProvisioningRequiredError) {
    return Response.json(
      { error: { message: "Your Waypoint account is still being prepared." } },
      { status: 503 },
    );
  }
  console.error("Career narrative import failed", { category: error instanceof Error ? error.name : "UnknownError" });
  return Response.json(
    {
      error: {
        message:
          safeAiErrorMessage(error),
      },
    },
    { status: 500 },
  );
}
