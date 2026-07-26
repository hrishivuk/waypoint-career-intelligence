import { describe, expect, it } from "vitest";

import { parseCvDeterministically } from "./deterministic-cv-parser";

describe("parseCvDeterministically", () => {
  it("creates ATS sections and exact source-backed claims", () => {
    const source = "Jane Doe\njane@example.com\n\nSUMMARY\nFrontend engineer\n\nSKILLS\nReact, TypeScript\n\nEXPERIENCE\nBuilt accessible products";
    const result = parseCvDeterministically(source);

    expect(result.sections.map((section) => section.sectionType)).toEqual([
      "header", "summary", "skills", "experience",
    ]);
    expect(result.claims.some((claim) => claim.value === "React")).toBe(true);
    expect(
      result.claims.some((claim) =>
        claim.claimType === "experience" &&
        claim.value === "Built accessible products"
      ),
    ).toBe(true);
    expect(result.claims.every((claim) =>
      [
        "contact", "summary", "skill", "experience", "education",
        "project", "certification", "other",
      ].includes(claim.claimType)
    )).toBe(true);
    for (const claim of result.claims) {
      expect(result.text.slice(claim.startOffset, claim.endOffset)).toBe(claim.sourceText);
    }
  });
});
