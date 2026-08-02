import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { classifyProviderError } from "./safe-errors";

describe("classifyProviderError", () => {
  it.each([
    [{ status: 401, message: "bad sk-secret" }, "INVALID_CREDENTIAL", false],
    [{ status: 429, code: "insufficient_quota" }, "QUOTA_EXCEEDED", false],
    [{ status: 429 }, "RATE_LIMITED", true],
    [{ code: "ETIMEDOUT" }, "REQUEST_TIMEOUT", true],
    [{ status: 503 }, "PROVIDER_UNAVAILABLE", true],
    [new Error("request contained sk-secret"), "UNKNOWN_PROVIDER_ERROR", false],
  ] as const)("returns a safe taxonomy for %#", (source, code, retryable) => {
    const result = classifyProviderError(source);
    expect(result.code).toBe(code);
    expect(result.retryable).toBe(retryable);
    expect(result.message).not.toContain("sk-secret");
  });
});
