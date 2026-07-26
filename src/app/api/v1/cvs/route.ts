import { createHash, randomUUID } from "node:crypto";

import { FixedPrototypeIdentityProvider } from "@/infrastructure/auth/fixed-prototype-identity";
import { parseCvDeterministically } from "@/infrastructure/cv/deterministic-cv-parser";
import {
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
} from "@/infrastructure/documents/document-text-extractor";
import { createDocumentTextExtractor } from "@/infrastructure/documents/create-document-text-extractor";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export const dynamic = "force-dynamic";

const identity = new FixedPrototypeIdentityProvider();
const BUCKET = "career-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const acceptedTypes = new Set([PDF_MIME_TYPE, DOCX_MIME_TYPE]);

function serialize(document: Record<string, unknown>) {
  return {
    id: document.id,
    displayName: document.display_name,
    originalFilename: document.original_filename,
    mimeType: document.mime_type,
    byteSize: Number(document.byte_size),
    intendedRoles: document.intended_roles ?? [],
    notes: document.notes,
    processingStatus: document.processing_status,
    processingError: document.processing_error,
    pageCount: document.page_count,
    parserVersion: document.parser_version,
    createdAt: document.created_at,
    sections: ((document.cv_sections_v2 as Array<Record<string, unknown>> | null) ?? [])
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((section) => ({
        id: section.id,
        sectionType: section.section_type,
        heading: section.heading,
        content: section.content,
        position: section.position,
      })),
    claims: ((document.cv_claims_v2 as Array<Record<string, unknown>> | null) ?? [])
      .map((claim) => ({
        id: claim.id,
        claimType: claim.claim_type,
        label: claim.label,
        value: claim.value,
        sourceText: claim.source_text,
      })),
  };
}

export async function GET() {
  try {
    const { userId } = await identity.getActor();
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("cv_documents_v2")
      .select("*, cv_sections_v2(*), cv_claims_v2(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ cvs: (data ?? []).map(serialize) });
  } catch (error) {
    console.error("CV v2 list failed", error);
    return Response.json(
      { error: "Unable to load CVs. Make sure the CV System v2 migration has been run." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  let uploadedPath: string | null = null;
  let documentId: string | null = null;
  try {
    const { userId } = await identity.getActor();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose a PDF or DOCX file." }, { status: 400 });
    }
    if (!acceptedTypes.has(file.type) || file.size <= 0 || file.size > MAX_BYTES) {
      return Response.json(
        { error: "The CV must be a PDF or DOCX no larger than 10 MB." },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const displayName = String(form.get("displayName") || file.name.replace(/\.[^.]+$/, ""))
      .trim().slice(0, 120);
    const intendedRoles = String(form.get("intendedRoles") || "")
      .split(",").map((role) => role.trim()).filter(Boolean).slice(0, 12);
    const notes = String(form.get("notes") || "").trim().slice(0, 2_000) || null;
    documentId = randomUUID();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    uploadedPath = `${userId}/cv-v2/${documentId}/${safeFilename}`;

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(uploadedPath, bytes, { contentType: file.type, upsert: false });
    if (storageError) throw storageError;

    const { error: insertError } = await supabase.from("cv_documents_v2").insert({
      id: documentId,
      user_id: userId,
      display_name: displayName || "Untitled CV",
      original_filename: file.name,
      mime_type: file.type,
      byte_size: file.size,
      sha256,
      storage_bucket: BUCKET,
      storage_path: uploadedPath,
      intended_roles: intendedRoles,
      notes,
      processing_status: "processing",
    });
    if (insertError) throw insertError;

    try {
      const extracted = await createDocumentTextExtractor().extract({
        bytes,
        mimeType: file.type,
        filename: file.name,
      });
      const parsed = parseCvDeterministically(extracted.text);
      const { data: insertedSections, error: sectionError } = await supabase
        .from("cv_sections_v2")
        .insert(parsed.sections.map((section) => ({
          cv_document_id: documentId,
          section_type: section.sectionType,
          heading: section.heading,
          content: section.content,
          position: section.position,
          start_offset: section.startOffset,
          end_offset: section.endOffset,
        })))
        .select("id, position");
      if (sectionError) throw sectionError;
      const sectionIds = new Map(
        (insertedSections ?? []).map((section) => [section.position, section.id]),
      );
      if (parsed.claims.length) {
        const { error: claimError } = await supabase.from("cv_claims_v2").insert(
          parsed.claims.map((claim) => ({
            cv_document_id: documentId,
            section_id: sectionIds.get(claim.sectionPosition),
            claim_type: claim.claimType,
            label: claim.label,
            value: claim.value,
            source_text: claim.sourceText,
            start_offset: claim.startOffset,
            end_offset: claim.endOffset,
          })),
        );
        if (claimError) throw claimError;
      }
      const { error: updateError } = await supabase.from("cv_documents_v2").update({
        processing_status: "ready",
        processing_error: null,
        extracted_text: parsed.text,
        page_count: extracted.pageCount ?? null,
      }).eq("id", documentId).eq("user_id", userId);
      if (updateError) throw updateError;
    } catch (processingError) {
      console.error("CV v2 parsing failed", processingError);
      await supabase.from("cv_documents_v2").update({
        processing_status: "failed",
        processing_error: processingError instanceof Error
          ? processingError.message.slice(0, 1_000)
          : "The document could not be parsed.",
      }).eq("id", documentId).eq("user_id", userId);
    }

    const { data, error } = await supabase
      .from("cv_documents_v2")
      .select("*, cv_sections_v2(*), cv_claims_v2(*)")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return Response.json({ cv: serialize(data) }, { status: 201 });
  } catch (error) {
    console.error("CV v2 upload failed", error);
    if (documentId) await supabase.from("cv_documents_v2").delete().eq("id", documentId);
    if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
    const duplicate = typeof error === "object" && error !== null &&
      "code" in error && error.code === "23505";
    return Response.json(
      { error: duplicate ? "This exact CV is already in your library." : "The CV could not be uploaded." },
      { status: duplicate ? 409 : 500 },
    );
  }
}

