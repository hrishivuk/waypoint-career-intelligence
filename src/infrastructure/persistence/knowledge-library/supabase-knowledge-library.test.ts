import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { KnowledgeLibrarySection } from "@/application/knowledge-library";
import { mergeKnowledgeLibrarySections } from "./supabase-knowledge-library";

function section(
  items: Array<{ id: string; title: string; sourceType: string }>,
): KnowledgeLibrarySection {
  return {
    key: "skills",
    title: "Skills",
    description: "Skills",
    items: items.map((item) => ({
      ...item,
      summary: null,
      status: "confirmed",
      confidence: null,
      tags: [],
      details: {},
    })),
  };
}

describe("mixed Career Profile knowledge", () => {
  it("preserves legacy records while master records replace matching identities", () => {
    const [merged] = mergeKnowledgeLibrarySections(
      [
        section([
          { id: "legacy-react", title: "React", sourceType: "legacy" },
          { id: "legacy-ts", title: "TypeScript", sourceType: "legacy" },
        ]),
      ],
      [
        section([
          { id: "master-react", title: " react ", sourceType: "career_narrative" },
          { id: "master-figma", title: "Figma", sourceType: "career_narrative" },
        ]),
      ],
    );

    expect(merged.items.map(({ id }) => id)).toEqual([
      "master-react",
      "legacy-ts",
      "master-figma",
    ]);
  });
});
