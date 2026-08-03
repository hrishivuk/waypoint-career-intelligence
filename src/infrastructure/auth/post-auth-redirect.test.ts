import { describe, expect, it } from "vitest";

import { postAuthDestination } from "./post-auth-redirect";

describe("post-authentication destination", () => {
  it("sends an incomplete account to onboarding", () => {
    expect(postAuthDestination("/", null)).toBe("/onboarding");
    expect(postAuthDestination("/jobs/new", undefined)).toBe("/onboarding");
  });

  it("keeps onboarding destinations and respects returning-user redirects", () => {
    expect(postAuthDestination("/onboarding", null)).toBe("/onboarding");
    expect(postAuthDestination("/jobs/new", "2026-08-03T12:00:00Z")).toBe("/jobs/new");
  });

  it("sends a completed account to Home without keeping onboarding in the way", () => {
    const completedAt = "2026-08-03T12:00:00Z";

    expect(postAuthDestination("/", completedAt)).toBe("/");
    expect(postAuthDestination("/onboarding", completedAt)).toBe("/onboarding");
  });
});
