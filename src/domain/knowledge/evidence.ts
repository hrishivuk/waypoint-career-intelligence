import type { LifecycleDate, TemporalLifecycle } from "./lifecycle";

export type EvidenceType =
  | "employment"
  | "project"
  | "education"
  | "achievement"
  | "responsibility"
  | "deliverable"
  | "outcome"
  | "technology"
  | "research"
  | "design_work";

export interface EvidenceRecord extends TemporalLifecycle {
  id: string;
  candidateId: string;
  evidenceType: EvidenceType;
  title: string;
  summary: string;
  organisation?: string;
  outcome?: string;
  startedAt?: LifecycleDate;
  endedAt?: LifecycleDate;
  parentEvidenceId?: string;
  documentIds: string[];
  skillIds: string[];
  technologies: string[];
}

export function confirmedEvidence(
  evidence: EvidenceRecord[],
): EvidenceRecord[] {
  return evidence.filter((record) => record.status === "confirmed");
}
