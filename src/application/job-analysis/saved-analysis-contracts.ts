import type { JobAnalysisResult } from "./contracts"

export type SavedAnalysisResultCompatibility =
  | "current"
  | "legacy"
  | "invalid"

export interface SavedJobAnalysisSummary {
  analysisId: string
  jobId: string
  title: string | null
  company: string | null
  recommendation: JobAnalysisResult["recommendation"]
  overallScore: number
  summary: string
  createdAt: string
  completedAt: string
}

export interface SavedJobAnalysisDetail {
  analysis: JobAnalysisResult
  jobDescription: string
  sourceUrl: string | null
  status: "completed"
  confidence: number | null
  modelId: string
  promptVersion: string
  schemaVersion: string
  scoringPolicyVersion: string
  createdAt: string
  updatedAt: string
  completedAt: string
  resultCompatibility: SavedAnalysisResultCompatibility
}
