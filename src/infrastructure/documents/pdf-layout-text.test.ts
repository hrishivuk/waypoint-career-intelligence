import { describe, expect, it } from "vitest";

import { reconstructPdfPageText } from "./pdf-layout-text";

describe("reconstructPdfPageText", () => {
  it("preserves headings and content on separate PDF rows", () => {
    const item = (str: string, x: number, y: number, width: number, hasEOL = false) => ({
      str,
      transform: [1, 0, 0, 1, x, y],
      width,
      height: 10,
      hasEOL,
    });
    const text = reconstructPdfPageText([
      item("SKILLS", 40, 700, 45, true),
      item("React", 40, 680, 30),
      item("TypeScript", 80, 680, 55, true),
      item("EXPERIENCE", 40, 650, 75, true),
      item("Frontend Developer", 40, 630, 100, true),
    ]);

    expect(text).toBe(
      "SKILLS\nReact TypeScript\nEXPERIENCE\nFrontend Developer",
    );
  });
});

