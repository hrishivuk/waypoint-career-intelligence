import type {
  ImportDiagnostic,
  ImportTable,
  ProposedHandoverImportPlan,
  ProposedImportOperation,
} from "@/application/handover-import";

type ParsedRecord = Record<string, unknown> & {
  id: string;
  type: string;
  status: string;
};

export interface ImportPlanInput {
  candidateId: string;
  sourceDocumentId: string;
  records: ParsedRecord[];
  /**
   * Resolves handover document references to owned documents. The handover
   * source itself should normally be included.
   */
  documentIdsByReference: Readonly<Record<string, string>>;
  /** Existing owned mode UUIDs keyed by stable mode slug. */
  modeIdsBySlug?: Readonly<Record<string, string>>;
  /** Stable test/integration-supplied UUIDs keyed by handover record ID. */
  databaseIdFor(recordId: string): string;
}

const CONFIDENCE = { low: 0.33, medium: 0.67, high: 1 } as const;
const SEEDED_MODES = new Set(["primary-career", "temporary-income"]);

export function buildProposedHandoverImportPlan(
  input: ImportPlanInput,
): ProposedHandoverImportPlan {
  const diagnostics: ImportDiagnostic[] = [];
  const operations: ProposedImportOperation[] = [];
  const recordsById = new Map(input.records.map((record) => [record.id, record]));
  const cvRecords = new Map(
    input.records
      .filter((record) => record.type === "cv_artifact")
      .map((record) => [record.id, record]),
  );

  for (const record of input.records) {
    if (record.status !== "proposed") {
      diagnostics.push(error(
        "non_proposed_record",
        "Imported records must remain proposed.",
        record.id,
      ));
      continue;
    }
    const mode = optionalText(record.mode);
    if (mode && !input.modeIdsBySlug?.[mode]) {
      diagnostics.push(error(
        "unknown_mode_reference",
        `Record mode ${mode} is not resolved to an owned career mode.`,
        record.id,
      ));
      continue;
    }
    const mapped = mapRecord(record, input, recordsById, diagnostics);
    if (mapped) operations.push(mapped);
  }

  const mappedCvIds = new Set(
    operations
      .filter((operation) => operation.table === "cv_artifacts")
      .map((operation) => operation.recordId),
  );
  for (const record of input.records) {
    if (record.type !== "decision_policy") continue;
    const references = stringArray(record.cv_artifact_refs);
    for (const reference of references) {
      if (!cvRecords.has(reference)) {
        diagnostics.push(error(
          "unknown_cv_reference",
          `Decision policy references unknown CV artefact ${reference}.`,
          record.id,
        ));
        continue;
      }
      if (!mappedCvIds.has(reference)) {
        diagnostics.push(error(
          "unpersistable_cv_reference",
          `Decision policy CV artefact ${reference} has blocking persistence diagnostics.`,
          record.id,
        ));
        continue;
      }
      operations.push({
        recordId: `${record.id}:${reference}`,
        table: "decision_policy_cv_artifacts",
        action: "link",
        row: {
          user_id: input.candidateId,
          decision_policy_id: input.databaseIdFor(record.id),
          cv_artifact_id: input.databaseIdFor(reference),
        },
        dependsOn: [record.id, reference],
      });
    }
  }

  // Current Supabase REST writes cannot guarantee one transaction and most
  // typed tables do not persist a unique handover ID. Keep the complete plan
  // inspectable, but explicitly prevent lossy/duplicate writes.
  diagnostics.push(error(
    "transactional_persistence_unavailable",
    "A database transaction/RPC is required before this multi-table plan can be persisted.",
  ));
  diagnostics.push(error(
    "idempotency_key_not_persisted",
    "Typed knowledge tables need a unique source record ID or import ledger before retries are safe.",
  ));

  return {
    candidateId: input.candidateId,
    sourceDocumentId: input.sourceDocumentId,
    operations,
    diagnostics,
    requiresTransaction: true,
    persistable: diagnostics.every((item) => item.severity !== "error"),
  };
}

function mapRecord(
  record: ParsedRecord,
  input: ImportPlanInput,
  recordsById: Map<string, ParsedRecord>,
  diagnostics: ImportDiagnostic[],
): ProposedImportOperation | null {
  const id = input.databaseIdFor(record.id);
  const common = commonRow(record, input, id);

  switch (record.type) {
    case "stable_fact":
      return operation(record, "career_profile_facts", {
        id,
        user_id: input.candidateId,
        category: text(record.category, "other"),
        fact_key: `handover:${record.id}`,
        value: { statement: text(record.statement) },
        status: "proposed",
        confidence: confidence(record.confidence),
        source_document_id: input.sourceDocumentId,
        extraction_metadata: sourceMetadata(record),
        ...criticality(record),
        ...sourceLifecycle(record),
      });
    case "career_mode": {
      const slug = record.id;
      const seeded = SEEDED_MODES.has(slug);
      return {
        recordId: record.id,
        table: "career_modes",
        action: seeded ? "reconcile_seeded_mode" : "insert",
        row: {
          ...common,
          slug,
          name: text(record.name, slug),
          purpose: text(record.purpose),
          is_active: false,
          display_priority: integer(record.priority, 100),
          target_role_families: record.target_role_families ?? [],
          prohibited_role_families: record.prohibited_role_families ?? [],
        },
        dependsOn: [],
      };
    }
    case "preference":
      return operation(record, "typed_preferences", {
        ...common,
        record_type: "preference",
        subject: text(record.subject),
        value: record.value ?? record.ordered_values,
        value_shape: record.ordered_values ? "ordered" : "scalar",
        strength: text(record.strength, "neutral"),
        reason: text(record.reason),
        exceptions: record.exceptions ?? [],
      });
    case "working_style":
      return operation(record, "typed_preferences", {
        ...common,
        record_type: "working_style",
        subject: text(record.trait, record.id),
        value: text(record.description),
        value_shape: "scalar",
        strength: "neutral",
        reason: text(record.career_relevance),
        exceptions: record.exceptions ?? [],
      });
    case "decision_policy":
      return operation(record, "decision_policies", {
        ...common,
        policy_type: text(record.policy_type),
        rule_text: text(record.rule),
        enforcement: text(record.enforcement),
        task_scopes: record.task_scopes ?? [],
        priority: integer(record.priority, 100),
        exceptions: record.exceptions ?? [],
        decision_key: text(record.decision_key),
        condition_operator: record.operator,
        condition_value: record.condition_value,
        effect: text(record.effect),
        numeric_modifier: record.modifier,
      });
    case "cv_artifact":
      return mapCvArtifact(record, input, recordsById, diagnostics, common);
    case "skill":
      return operation(record, "skills", {
        ...common,
        name: text(record.name),
        category: text(record.category),
        aliases: record.aliases ?? [],
      });
    case "evidence": {
      const parentReference = optionalText(record.parent_ref);
      const parentId = parentReference
        ? referenceId(parentReference, input, recordsById, diagnostics, record.id)
        : undefined;
      if (parentReference && !parentId) return null;
      return operation(record, "evidence_records", {
        ...common,
        parent_evidence_id: parentId,
        kind: text(record.evidence_type),
        title: text(record.title),
        narrative: text(record.summary),
        organisation: record.organisation,
        attributes: {
          outcome: record.outcome,
          technologies: record.technologies ?? [],
          handover_parent_ref: record.parent_ref,
        },
        source_occurred_from: record.start_date,
        source_occurred_until: record.end_date,
      }, optionalDependency(parentReference));
    }
    case "capability_assessment": {
      const skillId = referenceId(
        record.skill_ref,
        input,
        recordsById,
        diagnostics,
        record.id,
      );
      if (!skillId) return null;
      return operation(record, "capability_assessments", {
        ...common,
        skill_id: skillId,
        current_level: text(record.current_level),
        target_level: record.target_level,
        context: text(record.context),
        development_objective: record.development_objective,
        source_assessed_date: record.assessment_date,
      }, optionalDependency(record.skill_ref));
    }
    case "temporary_state":
      return operation(record, "temporary_states", {
        ...common,
        state_type: text(record.state_type, "other"),
        value: record.value,
        source_ref: {
          ...asRecord(common.source_ref),
          reason: record.reason,
        },
      });
    case "historical_observation":
      diagnostics.push(error(
        "historical_timestamp_schema_gap",
        "Historical observations require an exact observed_at timestamp; a precision date must not be converted to an invented timestamp.",
        record.id,
      ));
      return null;
    case "uncertainty":
      return operation(record, "knowledge_uncertainties", {
        ...common,
        topic: text(record.topic),
        description: text(record.description),
        resolution_needed: text(record.resolution_needed),
        contradicts: record.contradicts ?? [],
        candidate_values: record.candidate_values ?? [],
      });
    default:
      diagnostics.push(error(
        "unsupported_record_type",
        `No safe persistence mapping exists for ${record.type}.`,
        record.id,
      ));
      return null;
  }
}

function mapCvArtifact(
  record: ParsedRecord,
  input: ImportPlanInput,
  recordsById: Map<string, ParsedRecord>,
  diagnostics: ImportDiagnostic[],
  common: Record<string, unknown>,
): ProposedImportOperation | null {
  const documentReference = text(record.source_document_ref);
  const documentId = input.documentIdsByReference[documentReference];
  if (!documentId) {
    diagnostics.push(error(
      "unknown_document_reference",
      `CV artefact source document ${documentReference} is not resolved.`,
      record.id,
    ));
    return null;
  }
  const supersedes = optionalText(record.supersedes);
  if (supersedes && recordsById.get(supersedes)?.type !== "cv_artifact") {
    diagnostics.push(error(
      "unknown_cv_reference",
      `CV artefact supersedes unknown CV artefact ${supersedes}.`,
      record.id,
    ));
    return null;
  }
  return operation(record, "cv_artifacts", {
    ...common,
    stable_id: record.id,
    name: text(record.name),
    intended_role_families: record.intended_role_families ?? [],
    source_document_id: documentId,
    revision_identifier: record.revision,
    emphasis_summary: record.emphasis,
    supersedes_artifact_id: supersedes
      ? input.databaseIdFor(supersedes)
      : undefined,
    last_reviewed_date: record.last_reviewed_at,
  }, optionalDependency(supersedes));
}

function commonRow(
  record: ParsedRecord,
  input: ImportPlanInput,
  id: string,
): Record<string, unknown> {
  return {
    id,
    user_id: input.candidateId,
    mode_id: optionalText(record.mode)
      ? input.modeIdsBySlug?.[text(record.mode)]
      : undefined,
    status: "proposed",
    confidence: confidence(record.confidence),
    source_type: "chat_handover",
    source_ref: sourceMetadata(record),
    tags: stringArray(record.tags),
    ...criticality(record),
    ...sourceLifecycle(record),
  };
}

function sourceLifecycle(record: ParsedRecord): Record<string, unknown> {
  return {
    source_valid_from: record.valid_from,
    source_valid_until: record.valid_until,
    source_last_confirmed: record.last_confirmed_at,
    source_review_after: record.review_after,
  };
}

function criticality(record: ParsedRecord): Record<string, unknown> {
  const level = text(record.criticality, "normal");
  return {
    criticality: level,
    stale_behavior:
      level === "critical"
        ? "force_investigate"
        : level === "important"
          ? "reduce_confidence"
          : "warn",
  };
}

function sourceMetadata(record: ParsedRecord): Record<string, unknown> {
  return {
    handover_record_id: record.id,
    provenance: record.provenance,
  };
}

function operation(
  record: ParsedRecord,
  table: ImportTable,
  row: Record<string, unknown>,
  dependsOn: string[] = [],
): ProposedImportOperation {
  return { recordId: record.id, table, action: "insert", row, dependsOn };
}

function referenceId(
  value: unknown,
  input: ImportPlanInput,
  records: Map<string, ParsedRecord>,
  diagnostics: ImportDiagnostic[],
  ownerId: string,
): string | undefined {
  const reference = optionalText(value);
  if (!reference) return undefined;
  if (!records.has(reference)) {
    diagnostics.push(error(
      "unknown_record_reference",
      `Record references unknown record ${reference}.`,
      ownerId,
    ));
    return undefined;
  }
  return input.databaseIdFor(reference);
}

function error(
  code: string,
  message: string,
  recordId?: string,
): ImportDiagnostic {
  return { severity: "error", code, message, recordId };
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function integer(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? Number(value) : fallback;
}

function confidence(value: unknown): number {
  return typeof value === "string" && value in CONFIDENCE
    ? CONFIDENCE[value as keyof typeof CONFIDENCE]
    : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function optionalDependency(value: unknown): string[] {
  const dependency = optionalText(value);
  return dependency ? [dependency] : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
