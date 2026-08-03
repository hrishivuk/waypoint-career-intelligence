export interface JobRequirementResult {
  /** Zero-based source order within the parsed job description. */
  position?: number;
  text: string;
  kind: string;
  required: boolean;
  match: "matched" | "partial" | "gap" | "uncertain";
  score: number;
  explanation: string;
  evidence: string[];
  outcome?: "supported" | "partially_supported" | "unknown" | "conflicts";
  criticality?:
    | "eligibility"
    | "mandatory_core"
    | "important"
    | "preferred"
    | "bonus"
    | "unclear";
  confidence?: number;
}

export interface JobAnalysisResult {
  analysisId: string;
  jobId: string;
  title: string | null;
  company: string | null;
  recommendation: "apply" | "investigate" | "skip";
  overallScore: number;
  requirementsScore: number;
  directionScore: number;
  preferenceScore: number;
  eligibilityScore?: number;
  evidenceConfidence?: number;
  knowledgeCoverage?: number;
  semanticStatus?: "completed" | "partial_fallback" | "deterministic_only";
  summary: string;
  blockers: string[];
  strengths: string[];
  gaps: string[];
  uncertainties: string[];
  requirements: JobRequirementResult[];
  bestCv: {
    id: string;
    name: string;
    score: number;
    reason: string;
    representedRequirements?: string[];
    missingImportantKnowledge?: string[];
    suggestedChanges?: string[];
    representedCount?: number;
    relevantCount?: number;
  } | null;
}
