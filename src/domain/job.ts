export type ScoreDimension =
  | "eligibility"
  | "requirements"
  | "context"
  | "impact"
  | "preference"
  | "communication";

export interface JobSourceCitation {
  start: number;
  end: number;
  excerpt: string;
}

export interface JobRequirement {
  id: string;
  statement: string;
  dimension: ScoreDimension;
  importance: number;
  mandatory: boolean;
  confidence: number;
  source: JobSourceCitation;
}

export interface ParsedJob {
  id: string;
  candidateId: string;
  title?: string;
  company?: string;
  description: string;
  requirements: JobRequirement[];
  createdAt: string;
}

