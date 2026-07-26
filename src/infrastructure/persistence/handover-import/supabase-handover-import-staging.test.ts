import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../supabase-server", () => ({
  getSupabaseServerClient: () => {
    throw new Error("Test must inject its RPC client.");
  },
}));

let SupabaseHandoverImportStaging: typeof import(
  "./supabase-handover-import-staging"
).SupabaseHandoverImportStaging;

beforeAll(async () => {
  ({ SupabaseHandoverImportStaging } = await import(
    "./supabase-handover-import-staging"
  ));
});

describe("SupabaseHandoverImportStaging", () => {
  it("calls the single transactional RPC with exact proposed candidates", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        import_run_id: "run-id",
        already_staged: false,
        candidate_count: 1,
      }],
      error: null,
    });
    const staging = new SupabaseHandoverImportStaging({ rpc });
    const candidate = {
      id: "skill-react",
      type: "skill",
      status: "proposed",
      confidence: "high",
    };

    await expect(staging.stageProposedImport({
      candidateId: "user-id",
      sourceDocumentId: "document-id",
      specificationVersion: "1.1",
      contentHash: "a".repeat(64),
      candidates: [candidate],
    })).resolves.toEqual({
      importRunId: "run-id",
      alreadyStaged: false,
      candidateCount: 1,
    });
    expect(rpc).toHaveBeenCalledWith(
      "stage_handover_import_v1_1",
      expect.objectContaining({ p_candidates: [candidate] }),
    );
  });

  it("rejects non-proposed input before calling persistence", async () => {
    const rpc = vi.fn();
    const staging = new SupabaseHandoverImportStaging({ rpc });

    await expect(staging.stageProposedImport({
      candidateId: "user-id",
      sourceDocumentId: "document-id",
      specificationVersion: "1.1",
      contentHash: "b".repeat(64),
      candidates: [{ id: "skill-react", type: "skill", status: "confirmed" }],
    })).rejects.toThrow("must be proposed");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns an idempotent existing-run result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        import_run_id: "existing-run",
        already_staged: true,
        candidate_count: 1,
      }],
      error: null,
    });
    const staging = new SupabaseHandoverImportStaging({ rpc });

    await expect(staging.stageProposedImport({
      candidateId: "user-id",
      sourceDocumentId: "document-id",
      specificationVersion: "1.1",
      contentHash: "c".repeat(64),
      candidates: [{ id: "skill-react", type: "skill", status: "proposed" }],
    })).resolves.toMatchObject({ alreadyStaged: true });
  });
});
