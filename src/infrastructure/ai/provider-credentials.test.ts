import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { credentialFingerprint, maskApiKey } from "./provider-credentials";

describe("provider credential display helpers", () => {
  it("creates a stable non-secret fingerprint", () => {
    expect(credentialFingerprint("secret")).toBe(
      credentialFingerprint("secret"),
    );
    expect(credentialFingerprint("secret")).not.toContain("secret");
    expect(credentialFingerprint("secret")).not.toBe(
      credentialFingerprint("other"),
    );
  });

  it("only exposes the final four key characters", () => {
    expect(maskApiKey("sk-1234567890abcd")).toBe("••••••••abcd");
    expect(maskApiKey("tiny")).toBe("••••••••");
  });
});
