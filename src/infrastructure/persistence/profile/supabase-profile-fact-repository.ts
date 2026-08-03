import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProfileFactRepository,
  StoredProfileFact,
} from "@/application/profile";
import type {
  FactConfirmation,
  ProfileFactCategory,
} from "@/domain/profile";

type DatabaseStatus =
  | "candidate"
  | "proposed"
  | "confirmed"
  | "rejected"
  | "superseded"
  | "stale";

interface ProfileFactRow {
  id: string;
  user_id: string;
  category: string;
  value: unknown;
  status: DatabaseStatus;
  confidence: number | string | null;
  extraction_metadata: unknown;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

const selection =
  "id, user_id, category, value, status, confidence, extraction_metadata, created_at, updated_at, reviewed_at";

export class SupabaseProfileFactRepository
  implements ProfileFactRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async listByCandidateId(candidateId: string): Promise<StoredProfileFact[]> {
    const { data, error } = await this.client
      .from("career_profile_facts")
      .select(selection)
      .eq("user_id", candidateId)
      .order("created_at", { ascending: false });

    if (error) throw persistenceError("load", error);
    return (data as ProfileFactRow[]).map(mapRow);
  }

  async getById(
    candidateId: string,
    factId: string,
  ): Promise<StoredProfileFact | null> {
    const { data, error } = await this.client
      .from("career_profile_facts")
      .select(selection)
      .eq("user_id", candidateId)
      .eq("id", factId)
      .maybeSingle();

    if (error) throw persistenceError("load", error);
    return data ? mapRow(data as ProfileFactRow) : null;
  }

  async create(fact: StoredProfileFact): Promise<StoredProfileFact> {
    const { data, error } = await this.client
      .from("career_profile_facts")
      .insert(toDatabaseRecord(fact))
      .select(selection)
      .single();

    if (error) throw persistenceError("create", error);
    return mapRow(data as ProfileFactRow);
  }

  async update(fact: StoredProfileFact): Promise<StoredProfileFact> {
    const record = toDatabaseRecord(fact);
    const { data, error } = await this.client
      .from("career_profile_facts")
      .update({
        value: record.value,
        status: record.status,
        reviewed_at: record.reviewed_at,
        extraction_metadata: record.extraction_metadata,
      })
      .eq("user_id", fact.candidateId)
      .eq("id", fact.id)
      .select(selection)
      .maybeSingle();

    if (error) throw persistenceError("update", error);
    if (!data) {
      throw new Error("Profile fact disappeared during update.");
    }
    return mapRow(data as ProfileFactRow);
  }
}

function toDatabaseRecord(fact: StoredProfileFact) {
  return {
    id: fact.id,
    user_id: fact.candidateId,
    category: fact.category,
    fact_key: `manual:${fact.id}`,
    value: { statement: fact.statement },
    status: mapConfirmationToStatus(fact.confirmation),
    confidence: fact.confidence,
    extraction_metadata: {
      tags: fact.tags,
      provenance: fact.provenance,
    },
    reviewed_at: fact.reviewedAt,
    created_at: fact.createdAt,
    updated_at: fact.updatedAt,
  };
}

function mapRow(row: ProfileFactRow): StoredProfileFact {
  const value = asRecord(row.value);
  const metadata = asRecord(row.extraction_metadata);
  return {
    id: row.id,
    candidateId: row.user_id,
    category: row.category as ProfileFactCategory,
    statement:
      typeof value.statement === "string"
        ? value.statement
        : typeof row.value === "string"
          ? row.value
          : "",
    confirmation: mapStatusToConfirmation(row.status),
    confidence:
      row.confidence === null ? 1 : Number.parseFloat(String(row.confidence)),
    tags: Array.isArray(metadata.tags)
      ? metadata.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    provenance: Array.isArray(metadata.provenance)
      ? metadata.provenance.filter(isProvenance)
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
  };
}

function mapStatusToConfirmation(status: DatabaseStatus): FactConfirmation {
  if (status === "candidate" || status === "proposed") return "proposed";
  return status;
}

function mapConfirmationToStatus(
  confirmation: FactConfirmation,
): DatabaseStatus {
  return confirmation;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isProvenance(
  value: unknown,
): value is StoredProfileFact["provenance"][number] {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sourceId === "string" &&
    ["cv", "chat_handover", "user_input", "analysis_feedback"].includes(
      String(candidate.sourceType),
    ) &&
    typeof candidate.capturedAt === "string"
  );
}

function persistenceError(action: string, cause: unknown): Error {
  return new Error(`Unable to ${action} profile facts.`, { cause });
}
