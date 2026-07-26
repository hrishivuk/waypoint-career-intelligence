import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import { parseAndValidateHandoverV11 } from "../src/application/importer";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: stage-handover <path-to-v1.1-markdown>");
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const candidateId =
  process.env.PROTOTYPE_USER_ID ??
  "00000000-0000-4000-8000-000000000001";
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase environment variables are not configured.");
}

const absolutePath = resolve(inputPath);
const content = await readFile(absolutePath);
const markdown = content.toString("utf8");
const parsed = parseAndValidateHandoverV11(markdown);
if (parsed.diagnostics.length > 0) {
  console.error(JSON.stringify(parsed.diagnostics, null, 2));
  throw new Error("Handover validation failed; no remote writes were made.");
}

const contentHash = createHash("sha256").update(content).digest("hex");
const storagePath = `${candidateId}/handover/${contentHash}-${basename(absolutePath)}`;
const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let documentId: string | undefined;
const existing = await client
  .from("documents")
  .select("id")
  .eq("user_id", candidateId)
  .eq("storage_bucket", "career-documents")
  .eq("storage_path", storagePath)
  .maybeSingle();
if (existing.error) throw new Error(existing.error.message);
documentId = existing.data?.id;

if (!documentId) {
  const upload = await client.storage
    .from("career-documents")
    .upload(storagePath, content, {
      contentType: "text/markdown; charset=utf-8",
      upsert: false,
    });
  if (upload.error && !upload.error.message.toLowerCase().includes("exist")) {
    throw new Error(`Could not upload handover: ${upload.error.message}`);
  }

  const inserted = await client
    .from("documents")
    .insert({
      user_id: candidateId,
      kind: "career_handover",
      filename: basename(absolutePath),
      storage_bucket: "career-documents",
      storage_path: storagePath,
      mime_type: "text/markdown",
      byte_size: content.byteLength,
      sha256: contentHash,
      processing_status: "completed",
      metadata: {
        handover_format: parsed.envelope?.format,
        handover_version: parsed.envelope?.version,
        record_count: parsed.records.length,
      },
    })
    .select("id")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  documentId = inserted.data.id;
}

const staged = await client.rpc("stage_handover_import_v1_1", {
  p_user_id: candidateId,
  p_source_document_id: documentId,
  p_specification_version: "1.1",
  p_content_hash: contentHash,
  p_candidates: parsed.records,
  p_metadata: {
    filename: basename(absolutePath),
    format: parsed.envelope?.format,
    generated_at: parsed.envelope?.generated_at,
    generator: parsed.envelope?.generator,
  },
});
if (staged.error) throw new Error(staged.error.message);
const result = Array.isArray(staged.data) ? staged.data[0] : staged.data;
if (!result) throw new Error("Staging RPC returned no result.");

console.log(
  JSON.stringify(
    {
      documentId,
      importRunId: result.import_run_id,
      alreadyStaged: result.already_staged,
      candidateCount: result.candidate_count,
      contentHash,
    },
    null,
    2,
  ),
);
