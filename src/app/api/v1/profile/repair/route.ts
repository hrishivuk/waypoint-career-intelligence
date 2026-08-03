import { createHash } from "node:crypto";

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

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPAIR_VERSION = "master-profile-coverage-v1";

export async function POST() {
  try {
    const { actor, client } = await requireAuthenticatedContext();
    const [{ data: imports, error: importsError }, profileResult] =
      await Promise.all([
        client
          .from("career_narrative_imports")
          .select("id,source_text,model_metadata")
          .eq("user_id", actor.userId)
          .eq("status", "activated")
          .order("created_at"),
        client
          .from("master_profile_records")
          .select("id,record_type,title,statement")
          .eq("user_id", actor.userId)
          .eq("status", "confirmed"),
      ]);
    if (importsError) throw importsError;
    if (profileResult.error) throw profileResult.error;

    const uncovered: Array<{ id: string; text: string }> = [];
    for (const sourceImport of imports ?? []) {
      if (
        sourceImport.model_metadata &&
        typeof sourceImport.model_metadata === "object" &&
        !Array.isArray(sourceImport.model_metadata) &&
        "repairVersion" in sourceImport.model_metadata
      ) {
        continue;
      }
      const { data: candidates, error } = await client
        .from("career_narrative_candidates")
        .select("source_block_id")
        .eq("user_id", actor.userId)
        .eq("import_id", sourceImport.id);
      if (error) throw error;
      const covered = new Set(
        (candidates ?? []).map((candidate) => candidate.source_block_id),
      );
      for (const block of createDocumentTextBlocks(sourceImport.source_text)) {
        if (!covered.has(block.id)) {
          uncovered.push({
            id: `${sourceImport.id}:${block.id}`,
            text: block.text,
          });
        }
      }
    }
    if (!uncovered.length) {
      return Response.json({ repaired: 0, sourceBlocks: 0 });
    }

    const profile = profileResult.data ?? [];
    const existingByIdentity = new Map(
      profile.map((record) => [
        `${record.record_type}:${normalizeKey(record.title)}`,
        record,
      ]),
    );
    const ai = await createUserCareerAiGateway(client, actor.userId);
    const records: CareerNarrativeExtraction["records"] = [];
    const accounted = new Set<string>();
    const metadata: Array<Record<string, unknown>> = [];
    for (const batch of chunk(uncovered, 6)) {
      const result = await ai.extractCareerNarrative({
        blocks: batch,
        existingProfileRecords: profile.map((record) => ({
          id: record.id,
          recordType: record.record_type,
          title: record.title,
          statement: record.statement.slice(0, 240),
          structuredData: {},
        })),
      });
      records.push(...result.data.records);
      for (const id of [
        ...result.data.processedBlockIds,
        ...result.data.noClaimBlockIds,
        ...result.data.records.map((record) => record.blockId),
      ]) {
        if (batch.some((block) => block.id === id)) accounted.add(id);
      }
      metadata.push({
        responseId: result.responseId,
        model: result.model,
        promptVersion: result.promptVersion,
        warnings: result.data.warnings,
      });
    }
    const initiallyMissing = uncovered.filter(
      (block) => !accounted.has(block.id),
    );
    for (const block of initiallyMissing) {
      const retry = await ai.extractCareerNarrative({
        blocks: [block],
        existingProfileRecords: profile.map((record) => ({
          id: record.id,
          recordType: record.record_type,
          title: record.title,
          statement: record.statement.slice(0, 240),
          structuredData: {},
        })),
      });
      records.push(...retry.data.records);
      const retryAccounted = new Set([
        ...retry.data.processedBlockIds,
        ...retry.data.noClaimBlockIds,
        ...retry.data.records.map((record) => record.blockId),
      ]);
      if (retryAccounted.has(block.id)) accounted.add(block.id);
      metadata.push({
        responseId: retry.responseId,
        model: retry.model,
        promptVersion: retry.promptVersion,
        warnings: retry.data.warnings,
        singleBlockRetry: block.id,
      });
    }
    const missing = uncovered.filter((block) => !accounted.has(block.id));
    if (missing.length) {
      throw new Error(
        `Coverage repair left ${missing.length} source block(s) unresolved.`,
      );
    }

    const unique = [
      ...new Map(
        records.map((record) => [
          `${record.recordType}:${normalizeKey(record.title)}:${record.statement.toLowerCase()}`,
          record,
        ]),
      ).values(),
    ];
    if (!unique.length) {
      return Response.json({
        repaired: 0,
        sourceBlocks: uncovered.length,
        noClaimBlocks: uncovered.length,
      });
    }
    const repairText = uncovered
      .map((block) => `[${block.id}]\n${block.text}`)
      .join("\n\n");
    const sourceHash = createHash("sha256")
      .update(`${REPAIR_VERSION}\n${repairText}`)
      .digest("hex");
    const { data: repairImport, error: repairImportError } = await client
      .from("career_narrative_imports")
      .upsert(
        {
          user_id: actor.userId,
          source_text: repairText,
          source_hash: sourceHash,
          status: "staged",
          model_metadata: {
            repairVersion: REPAIR_VERSION,
            sourceBlocks: uncovered.length,
            accountedBlockIds: [...accounted],
            runs: metadata,
          },
        },
        { onConflict: "user_id,source_hash", ignoreDuplicates: true },
      )
      .select("id,status")
      .maybeSingle();
    if (repairImportError) throw repairImportError;
    if (!repairImport) {
      return Response.json({ repaired: 0, alreadyRepaired: true });
    }

    const candidates = unique.map((record, index) => {
      const target = existingByIdentity.get(
        `${record.recordType}:${normalizeKey(record.title)}`,
      );
      const reconciliation = target
        ? target.statement.trim().toLowerCase() ===
          record.statement.trim().toLowerCase()
          ? "already_known"
          : "update_existing"
        : "new";
      return {
        user_id: actor.userId,
        import_id: repairImport.id,
        record_type: record.recordType,
        title: record.title.trim(),
        statement: record.statement.trim(),
        structured_data: {
          proficiency: record.proficiency,
          proficiencyBasis: record.proficiencyBasis,
          tags: record.tags,
        },
        source_block_id: record.blockId,
        source_excerpt:
          uncovered.find((block) => block.id === record.blockId)?.text ?? "",
        confidence: record.confidence,
        decision: reconciliation === "new" ? "confirmed" : "rejected",
        reconciliation,
        target_record_id: target?.id ?? null,
        canonical_key: `${normalizeKey(record.recordType)}-${normalizeKey(record.title)}`,
        display_order: index,
      };
    });
    const { error: candidateError } = await client
      .from("career_narrative_candidates")
      .insert(candidates);
    if (candidateError) throw candidateError;
    // Activation is the sole elevated operation in this route. The RPC is
    // explicitly granted only to service_role and performs an atomic,
    // ownership-checked reconciliation.
    const { data: activated, error: activationError } = await client.rpc(
      "activate_career_narrative_import_v2",
      { p_user_id: actor.userId, p_import_id: repairImport.id },
    );
    if (activationError) throw activationError;
    return Response.json({
      repaired: Number(activated ?? 0),
      sourceBlocks: uncovered.length,
      extractedCandidates: candidates.length,
      updatesPreserved: candidates.filter(
        (candidate) => candidate.reconciliation !== "new",
      ).length,
    });
  } catch (error) {
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
    console.error("Master Profile repair failed", { category: error instanceof Error ? error.name : "UnknownError" });
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

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
