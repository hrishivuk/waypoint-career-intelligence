import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public Application Kit seed contract", () => {
  it("does not seed creator-specific roles, preferences, or first-person answers", () => {
    const source = readFileSync(join(__dirname, "application-kit.ts"), "utf8");
    for (const creatorSpecificText of [
      "I am a frontend engineer",
      "Product Design CV",
      "UX CV",
      "Frontend Engineer, Product Engineer",
      "Employment type\", \"Full-time",
    ]) {
      expect(source).not.toContain(creatorSpecificText);
    }
  });

  it("marks blank reusable answers as manual instead of profile-derived", () => {
    const source = readFileSync(join(__dirname, "application-kit.ts"), "utf8");
    expect(source).toContain('["Tell us about yourself", "", "manual"]');
    expect(source).toContain('["Why should we hire you?", "", "manual"]');
  });
});
