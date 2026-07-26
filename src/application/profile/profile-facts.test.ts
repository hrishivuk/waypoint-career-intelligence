import { describe, expect, it } from "vitest";
import type { StoredProfileFact } from "./contracts";
import { CreateManualProfileFact } from "./create-manual-profile-fact";
import {
  InvalidProfileFactError,
  InvalidProfileFactTransitionError,
  ProfileFactNotFoundError,
} from "./errors";
import { ListProfileFacts } from "./list-profile-facts";
import type { ProfileFactRepository } from "./ports";
import { UpdateProfileFactValue } from "./update-profile-fact-value";

const now = new Date("2026-07-24T12:00:00.000Z");

function fact(overrides: Partial<StoredProfileFact> = {}): StoredProfileFact {
  return {
    id: "fact-1",
    candidateId: "candidate-1",
    category: "skill",
    statement: "TypeScript",
    tags: ["technical"],
    confirmation: "proposed",
    confidence: 0.8,
    provenance: [
      {
        sourceId: "document-1",
        sourceType: "cv",
        capturedAt: "2026-07-23T12:00:00.000Z",
      },
    ],
    createdAt: "2026-07-23T12:00:00.000Z",
    updatedAt: "2026-07-23T12:00:00.000Z",
    reviewedAt: null,
    ...overrides,
  };
}

function repository(initial: StoredProfileFact[] = []): {
  port: ProfileFactRepository;
  records: StoredProfileFact[];
} {
  const records = [...initial];
  return {
    records,
    port: {
      listByCandidateId: async (candidateId) =>
        records.filter((item) => item.candidateId === candidateId),
      getById: async (candidateId, factId) =>
        records.find(
          (item) => item.candidateId === candidateId && item.id === factId,
        ) ?? null,
      create: async (item) => {
        records.push(item);
        return item;
      },
      update: async (item) => {
        const index = records.findIndex(
          (existing) =>
            existing.candidateId === item.candidateId && existing.id === item.id,
        );
        if (index >= 0) records[index] = item;
        return item;
      },
    },
  };
}

describe("profile fact application use cases", () => {
  it("creates normalized manual facts as confirmed user evidence", async () => {
    const facts = repository();
    const useCase = new CreateManualProfileFact({
      facts: facts.port,
      ids: { generate: () => "fact-new" },
      clock: { now: () => now },
    });

    const result = await useCase.execute({
      candidateId: "candidate-1",
      category: "interest",
      statement: "  Climate technology  ",
      tags: [" impact ", "impact", ""],
    });

    expect(result).toMatchObject({
      id: "fact-new",
      category: "interest",
      statement: "Climate technology",
      tags: ["impact"],
      confirmation: "confirmed",
      confidence: 1,
      reviewedAt: now.toISOString(),
    });
    expect(facts.records[0].candidateId).toBe("candidate-1");
    expect(facts.records[0].provenance[0]).toMatchObject({
      sourceId: "fact-new",
      sourceType: "user_input",
    });
  });

  it("rejects invalid categories at runtime", async () => {
    const facts = repository();
    const useCase = new CreateManualProfileFact({
      facts: facts.port,
      ids: { generate: () => "fact-new" },
      clock: { now: () => now },
    });

    await expect(
      useCase.execute({
        candidateId: "candidate-1",
        category: "unknown" as "skill",
        statement: "A fact",
      }),
    ).rejects.toBeInstanceOf(InvalidProfileFactError);
    expect(facts.records).toHaveLength(0);
  });

  it("lists only repository-scoped facts in the API envelope", async () => {
    const facts = repository([
      fact(),
      fact({ id: "fact-2", candidateId: "candidate-2" }),
    ]);

    const result = await new ListProfileFacts(facts.port).execute("candidate-1");

    expect(result.facts.map((item) => item.id)).toEqual(["fact-1"]);
  });

  it("updates a statement while preserving ownership and provenance", async () => {
    const original = fact();
    const facts = repository([original]);
    const result = await new UpdateProfileFactValue({
      facts: facts.port,
      clock: { now: () => now },
    }).execute({
      candidateId: "candidate-1",
      factId: "fact-1",
      statement: "  Advanced TypeScript  ",
    });

    expect(result.statement).toBe("Advanced TypeScript");
    expect(result.confirmation).toBe("proposed");
    expect(result.provenance).toEqual(original.provenance);
    expect(result.updatedAt).toBe(now.toISOString());
  });

  it("allows proposed facts to be confirmed or rejected and timestamps review", async () => {
    const facts = repository([fact()]);
    const result = await new UpdateProfileFactValue({
      facts: facts.port,
      clock: { now: () => now },
    }).execute({
      candidateId: "candidate-1",
      factId: "fact-1",
      confirmation: "confirmed",
    });

    expect(result.confirmation).toBe("confirmed");
    expect(result.reviewedAt).toBe(now.toISOString());
  });

  it("prevents reviewed facts from changing lifecycle state", async () => {
    const facts = repository([fact({ confirmation: "confirmed", reviewedAt: now.toISOString() })]);
    const useCase = new UpdateProfileFactValue({
      facts: facts.port,
      clock: { now: () => now },
    });

    await expect(
      useCase.execute({
        candidateId: "candidate-1",
        factId: "fact-1",
        confirmation: "rejected",
      }),
    ).rejects.toBeInstanceOf(InvalidProfileFactTransitionError);
  });

  it("does not expose facts belonging to another candidate", async () => {
    const facts = repository([fact({ candidateId: "candidate-2" })]);
    const useCase = new UpdateProfileFactValue({
      facts: facts.port,
      clock: { now: () => now },
    });

    await expect(
      useCase.execute({
        candidateId: "candidate-1",
        factId: "fact-1",
        statement: "Stolen update",
      }),
    ).rejects.toBeInstanceOf(ProfileFactNotFoundError);
  });
});
