import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "../../next.config";

describe("Content Security Policy", () => {
  it("allows React and HMR development tooling locally", () => {
    const policy = buildContentSecurityPolicy("development");
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("ws: wss:");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("keeps eval and websocket schemes forbidden in production", () => {
    const policy = buildContentSecurityPolicy("production");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("ws: wss:");
    expect(policy).toContain("upgrade-insecure-requests");
  });
});
