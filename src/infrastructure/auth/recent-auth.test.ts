import { describe, expect, it } from "vitest";

import { hasRecentSignIn } from "./recent-auth";

describe("recent authentication", () => {
  const now = Date.parse("2026-08-03T12:00:00.000Z");

  it("accepts a sign-in inside the destructive-action window", () => {
    expect(hasRecentSignIn("2026-08-03T11:50:00.000Z", now)).toBe(true);
  });

  it("rejects missing, invalid, future, and expired timestamps", () => {
    expect(hasRecentSignIn(undefined, now)).toBe(false);
    expect(hasRecentSignIn("invalid", now)).toBe(false);
    expect(hasRecentSignIn("2026-08-03T12:00:01.000Z", now)).toBe(false);
    expect(hasRecentSignIn("2026-08-03T11:44:59.000Z", now)).toBe(false);
  });
});
