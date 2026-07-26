import { describe, expect, it, vi } from "vitest";
import type {
  AnalysisRepository,
  CareerProfileRepository,
  EvidenceMatcher,
  JobRepository,
} from "./ports";
import { AnalyzeJob, CareerProfileNotFoundError } from "./analyze-job";
import type { CareerProfile, JobAnalysis, ParsedJob } from "../domain";

const profile: CareerProfile = {
  candidateId: "candidate-1",
  updatedAt: "2026-07-24T00:00:00.000Z",
  facts: [
    {
      id: "confirmed",
      category: "experience",
      statement: "Built a product",
      confidence: 1,
      confirmation: "confirmed",
      provenance: [],
      tags: [],
    },
    {
      id: "unconfirmed",
      category: "skill",
      statement: "Unverified skill",
      confidence: 0.7,
      confirmation: "proposed",
      provenance: [],
      tags: [],
    },
  ],
};

const job: ParsedJob = {
  id: "job-1",
  candidateId: profile.candidateId,
  description: "Build products",
  requirements: [],
  createdAt: "2026-07-24T00:00:00.000Z",
};

describe("AnalyzeJob", () => {
  it("only gives confirmed evidence to the matcher and persists the result", async () => {
    const savedJobs: ParsedJob[] = [];
    const savedAnalyses: JobAnalysis[] = [];
    const profiles: CareerProfileRepository = {
      getByCandidateId: async () => profile,
      save: async () => undefined,
    };
    const jobs: JobRepository = {
      getById: async () => null,
      save: async (value) => void savedJobs.push(value),
    };
    const analyses: AnalysisRepository = {
      getById: async () => null,
      listByCandidateId: async () => [],
      save: async (value) => void savedAnalyses.push(value),
    };
    let factsGivenToMatcher: string[] = [];
    const assess: EvidenceMatcher["assess"] = vi.fn(
      async ({ profile: inputProfile }: Parameters<EvidenceMatcher["assess"]>[0]) => {
        factsGivenToMatcher = inputProfile.facts.map((fact) => fact.id);
        return [];
      },
    );
    const useCase = new AnalyzeJob({
      profiles,
      jobs,
      analyses,
      parser: { parse: async () => job },
      matcher: { assess },
      ids: { generate: () => "analysis-1" },
      clock: { now: () => new Date("2026-07-24T12:00:00.000Z") },
    });

    const result = await useCase.execute({
      candidateId: profile.candidateId,
      description: job.description,
    });

    expect(factsGivenToMatcher).toEqual(["confirmed"]);
    expect(savedJobs).toEqual([job]);
    expect(savedAnalyses).toEqual([result]);
  });

  it("fails before parsing when the career profile is missing", async () => {
    const parse = vi.fn();
    const useCase = new AnalyzeJob({
      profiles: {
        getByCandidateId: async () => null,
        save: async () => undefined,
      },
      jobs: {
        getById: async () => null,
        save: async () => undefined,
      },
      analyses: {
        getById: async () => null,
        listByCandidateId: async () => [],
        save: async () => undefined,
      },
      parser: { parse },
      matcher: { assess: async () => [] },
      ids: { generate: () => "analysis-1" },
      clock: { now: () => new Date() },
    });

    await expect(
      useCase.execute({ candidateId: "missing", description: "Role" }),
    ).rejects.toBeInstanceOf(CareerProfileNotFoundError);
    expect(parse).not.toHaveBeenCalled();
  });
});
