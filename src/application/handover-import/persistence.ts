export type ImportTable =
  | "career_profile_facts"
  | "career_modes"
  | "typed_preferences"
  | "decision_policies"
  | "evidence_records"
  | "skills"
  | "capability_assessments"
  | "temporary_states"
  | "historical_observations"
  | "knowledge_uncertainties"
  | "cv_artifacts"
  | "decision_policy_cv_artifacts";

export interface ImportDiagnostic {
  severity: "warning" | "error";
  code: string;
  message: string;
  recordId?: string;
}

export interface ProposedImportOperation {
  recordId: string;
  table: ImportTable;
  action: "insert" | "reconcile_seeded_mode" | "link";
  row: Readonly<Record<string, unknown>>;
  dependsOn: string[];
}

export interface ProposedHandoverImportPlan {
  candidateId: string;
  sourceDocumentId: string;
  operations: ProposedImportOperation[];
  diagnostics: ImportDiagnostic[];
  /** Every operation must commit or roll back together. */
  requiresTransaction: true;
  /** False until diagnostics and persistence capabilities make writes safe. */
  persistable: boolean;
}

/**
 * Persistence deliberately consumes a completed plan rather than parser
 * records. Implementations must reject non-persistable plans and guarantee one
 * database transaction for all operations.
 */
export interface HandoverImportPersistence {
  persistProposedImport(plan: ProposedHandoverImportPlan): Promise<void>;
}

export interface StageProposedHandoverInput {
  candidateId: string;
  sourceDocumentId: string;
  specificationVersion: "1.1";
  /** Lowercase SHA-256 of the exact source handover content. */
  contentHash: string;
  /** Exact validated records, in source order. */
  candidates: ReadonlyArray<Readonly<Record<string, unknown>>>;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface StagedHandoverImport {
  importRunId: string;
  alreadyStaged: boolean;
  candidateCount: number;
}

export interface HandoverImportStaging {
  stageProposedImport(
    input: StageProposedHandoverInput,
  ): Promise<StagedHandoverImport>;
}
