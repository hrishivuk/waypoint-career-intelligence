import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../supabase-server", () => ({
  getSupabaseServerClient: () => {
    throw new Error("Test must inject its data client.");
  },
}));

let Repository: typeof import(
  "./supabase-handover-review-repository"
).SupabaseHandoverReviewRepository;

beforeAll(async () => {
  ({ SupabaseHandoverReviewRepository: Repository } = await import(
    "./supabase-handover-review-repository"
  ));
});

describe("SupabaseHandoverReviewRepository", () => {
  it("lists the active owner-scoped run in source order", async () => {
    const data = client();
    vi.mocked(data.findActiveRun).mockResolvedValue({
      id: "run",
      specification_version: "1.1",
      status: "staged",
      candidate_count: 1,
      created_at: "2026-07-25T00:00:00Z",
    });
    vi.mocked(data.findCandidates).mockResolvedValue([row()]);
    const result = await new Repository(data).findActive("owner");
    expect(data.findCandidates).toHaveBeenCalledWith("owner", "run");
    expect(result.candidates[0]).toMatchObject({
      stableRecordId: "skill-react",
      version: 0,
      effectiveRecord: { id: "skill-react", type: "skill", status: "proposed" },
    });
  });

  it("maps one review to the atomic RPC and rereads by owner", async () => {
    const data = client();
    vi.mocked(data.findCandidate).mockResolvedValue({
      ...row(),
      review_status: "confirmed",
      review_revision: 1,
      reviewed_at: "2026-07-25T01:00:00Z",
    });
    const result = await new Repository(data).reviewOne({
      candidateId: "owner",
      stagedCandidateId: "candidate",
      action: "confirm",
      expectedVersion: 0,
    });
    expect(data.rpc).toHaveBeenCalledWith(
      "review_handover_candidate_v1_1",
      {
        p_user_id: "owner",
        p_candidate_id: "candidate",
        p_expected_revision: 0,
        p_decision: "confirmed",
        p_corrected_record: null,
        p_notes: null,
      },
    );
    expect(result).toMatchObject({ reviewStatus: "confirmed", version: 1 });
  });
});

function client() {
  return {
    findActiveRun: vi.fn().mockResolvedValue(null),
    findCandidates: vi.fn().mockResolvedValue([]),
    findCandidate: vi.fn().mockResolvedValue(row()),
    rpc: vi.fn().mockResolvedValue({
      data: [{
        candidate_id: "candidate",
        review_status: "confirmed",
        review_revision: 1,
        reviewed_at: "2026-07-25T01:00:00Z",
      }],
      error: null,
    }),
  };
}

function row() {
  return {
    id: "candidate",
    import_run_id: "run",
    stable_record_id: "skill-react",
    record_type: "skill",
    exact_record: { id: "skill-react", type: "skill", status: "proposed" },
    corrected_record: null,
    section: "Skills and capability assessments",
    source_order: 0,
    review_status: "pending" as const,
    review_revision: 0,
    reviewed_at: null,
  };
}
