import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  getSavedJobAnalysis,
  listSavedJobAnalyses,
} from "./saved-job-analyses"

const baseRow = {
  id: "analysis-1",
  job_id: "job-1",
  recommendation: "apply",
  overall_score: 82,
  confidence: 0.84,
  summary: "Scalar summary",
  status: "completed",
  model_id: "model-1",
  prompt_version: "prompt-1",
  schema_version: "job-analysis-v2",
  scoring_policy_version: "policy-1",
  created_at: "2026-08-03T10:00:00Z",
  updated_at: "2026-08-03T10:01:00Z",
  completed_at: "2026-08-03T10:01:00Z",
  jobs: {
    id: "job-1",
    title: "Product Designer",
    company: "Example Co",
    description_text: "A sufficiently complete stored job description.",
    source_url: null,
    created_at: "2026-08-03T10:00:00Z",
  },
}

function clientReturning(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown]> = []
  const query = {
    select() {
      return this
    },
    eq(column: string, value: unknown) {
      calls.push([column, value])
      return this
    },
    order() {
      return this
    },
    limit: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  }
  const client = {
    from: vi.fn(() => query),
  } as unknown as SupabaseClient
  return { client, calls }
}

describe("saved job analysis reads", () => {
  it("lists completed analyses with scalar summary fields", async () => {
    const { client, calls } = clientReturning({ data: [baseRow], error: null })
    const result = await listSavedJobAnalyses(client, "user-1")

    expect(result[0]).toMatchObject({
      analysisId: "analysis-1",
      title: "Product Designer",
      recommendation: "apply",
      overallScore: 82,
      summary: "Scalar summary",
    })
    expect(calls).toContainEqual(["user_id", "user-1"])
    expect(calls).toContainEqual(["status", "completed"])
  })

  it("uses scalar analysis and job fields instead of conflicting JSON", async () => {
    const { client, calls } = clientReturning({
      data: {
        ...baseRow,
        result: {
          recommendation: "skip",
          overallScore: 1,
          summary: "Untrusted JSON summary",
          analysisEngineVersion: "waypoint-intelligence-v5-cv2",
          strengths: ["Relevant evidence"],
          scores: { requirements: 74 },
        },
      },
      error: null,
    })
    const result = await getSavedJobAnalysis(client, "user-1", "analysis-1")

    expect(result?.analysis).toMatchObject({
      title: "Product Designer",
      recommendation: "apply",
      overallScore: 82,
      summary: "Scalar summary",
      requirementsScore: 74,
      strengths: ["Relevant evidence"],
    })
    expect(result?.resultCompatibility).toBe("current")
    expect(calls).toContainEqual(["id", "analysis-1"])
    expect(calls).toContainEqual(["user_id", "user-1"])
  })

  it("tolerates legacy results with missing optional detail fields", async () => {
    const { client } = clientReturning({
      data: { ...baseRow, result: { strengths: ["Legacy strength"] } },
      error: null,
    })
    const result = await getSavedJobAnalysis(client, "user-1", "analysis-1")

    expect(result?.resultCompatibility).toBe("legacy")
    expect(result?.analysis.strengths).toEqual(["Legacy strength"])
    expect(result?.analysis.requirements).toEqual([])
    expect(result?.analysis.knowledgeCoverage).toBe(0)
  })

  it("returns a safe partial detail for corrupt result JSON", async () => {
    const { client } = clientReturning({
      data: { ...baseRow, result: "not-an-object" },
      error: null,
    })
    const result = await getSavedJobAnalysis(client, "user-1", "analysis-1")

    expect(result?.resultCompatibility).toBe("invalid")
    expect(result?.analysis.requirements).toEqual([])
    expect(result?.analysis.bestCv).toBeNull()
    expect(result?.analysis.summary).toBe("Scalar summary")
  })

  it("returns null for an owned lookup with no visible row", async () => {
    const { client } = clientReturning({ data: null, error: null })
    await expect(
      getSavedJobAnalysis(client, "user-1", "missing-analysis"),
    ).resolves.toBeNull()
  })

  it("does not hide database failures", async () => {
    const { client } = clientReturning({
      data: null,
      error: new Error("database unavailable"),
    })
    await expect(listSavedJobAnalyses(client, "user-1")).rejects.toThrow(
      "Unable to load saved job analyses.",
    )
  })
})
