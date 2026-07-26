import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../supabase-server", () => ({
  getSupabaseServerClient: () => {
    throw new Error("Test must inject its data client.");
  },
}));

let Repository: typeof import(
  "./supabase-handover-projection-repository"
).SupabaseHandoverProjectionRepository;

beforeAll(async () => {
  ({ SupabaseHandoverProjectionRepository: Repository } = await import(
    "./supabase-handover-projection-repository"
  ));
});

describe("SupabaseHandoverProjectionRepository", () => {
  it("loads only the reviewed candidates supplied by the owner-scoped query", async () => {
    const data = client();
    vi.mocked(data.findActiveRun).mockResolvedValue({ id: "run" });
    vi.mocked(data.findReviewedCandidates).mockResolvedValue([
      row("confirmed"),
      {
        ...row("corrected"),
        id: "candidate-corrected",
        stable_record_id: "skill-typescript",
        corrected_record: {
          id: "skill-typescript",
          type: "skill",
          status: "proposed",
          name: "TypeScript",
        },
      },
    ]);
    const result = await new Repository(data).findReviewedCandidates("owner");
    expect(data.findReviewedCandidates).toHaveBeenCalledWith("owner", "run");
    expect(result.candidates.map((item) => item.reviewStatus)).toEqual([
      "confirmed",
      "corrected",
    ]);
    expect(result.candidates[1].correctedRecord).toMatchObject({
      name: "TypeScript",
    });
  });

  it("calls the idempotent single-candidate RPC and reports resume state", async () => {
    const data = client();
    const repository = new Repository(data);
    await expect(
      repository.projectOne({
        candidateId: "owner",
        stagedCandidateId: "candidate",
      }),
    ).resolves.toEqual({ outcome: "already_projected" });
    expect(data.rpc).toHaveBeenCalledWith(
      "project_reviewed_handover_candidate_v1_1",
      { p_user_id: "owner", p_candidate_id: "candidate" },
    );
  });
});

function client() {
  return {
    findActiveRun: vi.fn().mockResolvedValue(null),
    findReviewedCandidates: vi.fn().mockResolvedValue([]),
    rpc: vi.fn().mockResolvedValue({
      data: [{
        candidate_id: "candidate",
        target_table: "skills",
        target_id: "target",
        already_projected: true,
      }],
      error: null,
    }),
  };
}

function row(reviewStatus: "confirmed" | "corrected") {
  return {
    id: "candidate",
    import_run_id: "run",
    stable_record_id: "skill-react",
    record_type: "skill",
    exact_record: {
      id: "skill-react",
      type: "skill",
      status: "proposed",
      name: "React",
    },
    corrected_record: null,
    source_order: 1,
    review_status: reviewStatus,
  };
}
