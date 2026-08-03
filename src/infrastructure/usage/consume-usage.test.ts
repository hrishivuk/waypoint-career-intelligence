import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/infrastructure/persistence/supabase-server", () => ({
  getSupabaseServerClient: () => ({ rpc: mocks.rpc }),
}));

import {
  AiConcurrencyLimitExceededError,
  withAiUsageLease,
} from "./consume-usage";

describe("AI usage leases", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("counts each provider call and releases its lease", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: "lease-1", error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const action = vi.fn().mockResolvedValue("result");

    await expect(withAiUsageLease("user-1", action)).resolves.toBe("result");
    expect(action).toHaveBeenCalledOnce();
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "acquire_waypoint_ai_request_lease",
      "consume_waypoint_daily_usage",
      "release_waypoint_ai_request_lease",
    ]);
  });

  it("releases the lease when the provider call fails", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: "lease-2", error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(withAiUsageLease("user-1", async () => {
      throw new Error("provider failed");
    })).rejects.toThrow("provider failed");
    expect(mocks.rpc).toHaveBeenLastCalledWith("release_waypoint_ai_request_lease", {
      target_user_id: "user-1",
      target_lease_id: "lease-2",
    });
  });

  it("returns a safe domain error when capacity is full", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "AI_CONCURRENCY_LIMIT" },
    });
    await expect(withAiUsageLease("user-1", async () => "unused"))
      .rejects.toBeInstanceOf(AiConcurrencyLimitExceededError);
  });
});
