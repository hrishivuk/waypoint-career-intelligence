import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type {
  JobAnalysisResult,
  JobRequirementResult,
  SavedAnalysisResultCompatibility,
  SavedJobAnalysisDetail,
  SavedJobAnalysisSummary,
} from "@/application/job-analysis"

type Row = Record<string, unknown>

const CURRENT_ENGINE_VERSION = "waypoint-intelligence-v5-cv2"

const recommendationSchema = z.enum(["apply", "investigate", "skip"])
const semanticStatusSchema = z.enum([
  "completed",
  "partial_fallback",
  "deterministic_only",
])
const requirementSchema = z.object({
  text: z.string().min(1),
  kind: z.string().catch("other"),
  required: z.boolean().catch(false),
  match: z.enum(["matched", "partial", "gap", "uncertain"]).catch("uncertain"),
  score: z.number().finite().min(0).max(100).catch(0),
  explanation: z.string().catch("No explanation was stored."),
  evidence: z.array(z.string()).catch([]),
  outcome: z
    .enum(["supported", "partially_supported", "unknown", "conflicts"])
    .optional()
    .catch(undefined),
  criticality: z
    .enum([
      "eligibility",
      "mandatory_core",
      "important",
      "preferred",
      "bonus",
      "unclear",
    ])
    .optional()
    .catch(undefined),
  confidence: z.number().finite().min(0).max(1).optional().catch(undefined),
})
const bestCvSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number().finite().min(0).max(100).catch(0),
  reason: z.string().catch("No recommendation reason was stored."),
  representedRequirements: z.array(z.string()).optional().catch(undefined),
  missingImportantKnowledge: z.array(z.string()).optional().catch(undefined),
  suggestedChanges: z.array(z.string()).optional().catch(undefined),
  representedCount: z.number().int().min(0).optional().catch(undefined),
  relevantCount: z.number().int().min(0).optional().catch(undefined),
})
const storedResultSchema = z.object({
  blockers: z.array(z.string()).catch([]),
  strengths: z.array(z.string()).catch([]),
  gaps: z.array(z.string()).catch([]),
  uncertainties: z.array(z.string()).catch([]),
  requirements: z.array(z.unknown()).catch([]),
  scores: z
    .object({
      requirements: z.number().finite().min(0).max(100).catch(0),
      careerDirection: z.number().finite().min(0).max(100).catch(0),
      preferences: z.number().finite().min(0).max(100).catch(0),
      eligibility: z.number().finite().min(0).max(100).catch(0),
      evidenceConfidence: z.number().finite().min(0).max(100).catch(0),
      knowledgeCoverage: z.number().finite().min(0).max(100).catch(0),
    })
    .catch({
      requirements: 0,
      careerDirection: 0,
      preferences: 0,
      eligibility: 0,
      evidenceConfidence: 0,
      knowledgeCoverage: 0,
    }),
  semanticStatus: semanticStatusSchema.catch("deterministic_only"),
  bestCv: z.unknown().optional(),
  analysisEngineVersion: z.string().optional(),
})

export async function listSavedJobAnalyses(
  client: SupabaseClient,
  userId: string,
  options: { limit?: number } = {},
): Promise<SavedJobAnalysisSummary[]> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20))
  const { data, error } = await client
    .from("analyses")
    .select(
      "id,job_id,recommendation,overall_score,summary,created_at,completed_at,jobs!analyses_job_owner_fk(id,title,company)",
    )
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error("Unable to load saved job analyses.", { cause: error })
  }

  return ((data ?? []) as Row[]).map(mapSummary)
}

export async function getSavedJobAnalysis(
  client: SupabaseClient,
  userId: string,
  analysisId: string,
): Promise<SavedJobAnalysisDetail | null> {
  const { data, error } = await client
    .from("analyses")
    .select(
      "id,job_id,recommendation,overall_score,confidence,summary,result,status,model_id,prompt_version,schema_version,scoring_policy_version,created_at,updated_at,completed_at,jobs!analyses_job_owner_fk(id,title,company,description_text,source_url,created_at)",
    )
    .eq("id", analysisId)
    .eq("user_id", userId)
    .eq("status", "completed")
    .maybeSingle()

  if (error) {
    throw new Error("Unable to load the saved job analysis.", { cause: error })
  }
  if (!data) return null
  return mapDetail(data as Row)
}

function mapSummary(row: Row): SavedJobAnalysisSummary {
  const job = relatedJob(row.jobs)
  return {
    analysisId: requiredString(row.id, "analysis id"),
    jobId: requiredString(row.job_id, "job id"),
    title: nullableString(job.title),
    company: nullableString(job.company),
    recommendation: recommendation(row.recommendation),
    overallScore: boundedScore(row.overall_score),
    summary: nullableString(row.summary) ?? "",
    createdAt: requiredString(row.created_at, "created timestamp"),
    completedAt: requiredString(row.completed_at, "completed timestamp"),
  }
}

function mapDetail(row: Row): SavedJobAnalysisDetail {
  const job = relatedJob(row.jobs)
  const rawResult = isRecord(row.result) ? row.result : null
  const parsed = storedResultSchema.parse(rawResult ?? {})
  const requirements = parsed.requirements.flatMap((value) => {
    const result = requirementSchema.safeParse(value)
    return result.success ? [result.data as JobRequirementResult] : []
  })
  const bestCvResult = bestCvSchema.safeParse(parsed.bestCv)
  const analysisId = requiredString(row.id, "analysis id")
  const jobId = requiredString(row.job_id, "job id")

  const analysis: JobAnalysisResult = {
    analysisId,
    jobId,
    title: nullableString(job.title),
    company: nullableString(job.company),
    recommendation: recommendation(row.recommendation),
    overallScore: boundedScore(row.overall_score),
    requirementsScore: parsed.scores.requirements,
    directionScore: parsed.scores.careerDirection,
    preferenceScore: parsed.scores.preferences,
    eligibilityScore: parsed.scores.eligibility,
    evidenceConfidence: parsed.scores.evidenceConfidence,
    knowledgeCoverage: parsed.scores.knowledgeCoverage,
    semanticStatus: parsed.semanticStatus,
    summary: nullableString(row.summary) ?? "",
    blockers: parsed.blockers,
    strengths: parsed.strengths,
    gaps: parsed.gaps,
    uncertainties: parsed.uncertainties,
    requirements,
    bestCv: bestCvResult.success ? bestCvResult.data : null,
  }

  return {
    analysis,
    jobDescription: requiredString(job.description_text, "job description"),
    sourceUrl: nullableString(job.source_url),
    status: "completed",
    confidence: nullableNumber(row.confidence),
    modelId: requiredString(row.model_id, "model id"),
    promptVersion: requiredString(row.prompt_version, "prompt version"),
    schemaVersion: requiredString(row.schema_version, "schema version"),
    scoringPolicyVersion: requiredString(
      row.scoring_policy_version,
      "scoring policy version",
    ),
    createdAt: requiredString(row.created_at, "created timestamp"),
    updatedAt: requiredString(row.updated_at, "updated timestamp"),
    completedAt: requiredString(row.completed_at, "completed timestamp"),
    resultCompatibility: resultCompatibility(rawResult),
  }
}

function resultCompatibility(
  result: Row | null,
): SavedAnalysisResultCompatibility {
  if (!result) return "invalid"
  return result.analysisEngineVersion === CURRENT_ENGINE_VERSION
    ? "current"
    : "legacy"
}

function relatedJob(value: unknown): Row {
  if (Array.isArray(value)) {
    const first = value[0]
    if (isRecord(first)) return first
  }
  if (isRecord(value)) return value
  throw new Error("Saved analysis is missing its job.")
}

function recommendation(value: unknown): JobAnalysisResult["recommendation"] {
  const parsed = recommendationSchema.safeParse(value)
  if (!parsed.success) throw new Error("Saved analysis has an invalid recommendation.")
  return parsed.data
}

function boundedScore(value: unknown) {
  const score = nullableNumber(value)
  if (score === null || score < 0 || score > 100) {
    throw new Error("Saved analysis has an invalid score.")
  }
  return score
}

function nullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Saved analysis is missing its ${field}.`)
  }
  return value
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null
}

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
