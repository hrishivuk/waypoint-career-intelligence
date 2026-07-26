import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildJobDescriptionParsingInstructions } from "./prompts";

describe("Groq block-evidence prompts", () => {
  it("does not also request source quotes or character offsets", () => {
    const prompt = buildJobDescriptionParsingInstructions("block_ids");

    expect(prompt).toContain("Cite only their block IDs");
    expect(prompt).not.toContain("must include an exact source quote");
    expect(prompt).not.toContain("zero-based character offsets");
  });
});
