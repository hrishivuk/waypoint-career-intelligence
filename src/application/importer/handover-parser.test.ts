import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  HANDOVER_V11_SECTIONS,
  parseAndValidateHandoverV11,
} from "./handover-parser";

const fixture = readFileSync(
  join(
    process.cwd(),
    "src/application/importer/fixtures/handover-v1.1-public.md",
  ),
  "utf8",
);

describe("Waypoint handover v1.1 parser", () => {
  it("parses and validates the public-safe 83-record fixture", () => {
    const result = parseAndValidateHandoverV11(fixture);
    expect(result.diagnostics).toEqual([]);
    expect(result.records).toHaveLength(83);
    expect(result.envelope?.version).toBe("1.1");
    expect(result.records.every((record) => record.status === "proposed")).toBe(
      true,
    );
  });

  it("rejects the wrong version and malformed front matter", () => {
    const result = parseAndValidateHandoverV11(
      fixture.replace('version: "1.1"', "version: 1"),
    );
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "envelope.version",
    );
  });

  it("requires exactly fourteen ordered sections", () => {
    const first = HANDOVER_V11_SECTIONS[0];
    const second = HANDOVER_V11_SECTIONS[1];
    const result = parseAndValidateHandoverV11(
      fixture
        .replace(`# ${first}`, "# Wrong section")
        .replace(`# ${second}`, `# ${first}`),
    );
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "sections.invalid",
    );
  });

  it("rejects duplicate record IDs deterministically", () => {
    const firstId = String(
      parseAndValidateHandoverV11(fixture).records[0].id,
    );
    const secondId = String(
      parseAndValidateHandoverV11(fixture).records[1].id,
    );
    const result = parseAndValidateHandoverV11(
      fixture.replace(`id: ${secondId}`, `id: ${firstId}`),
    );
    expect(result.diagnostics).toContainEqual({
      code: "record.invalid",
      message: "Record IDs must be unique.",
    });
  });

  it("rejects broken and mistyped references", () => {
    const broken = parseAndValidateHandoverV11(
      fixture.replace(
        "evidence-education-msc-tud",
        "evidence-record-that-does-not-exist",
      ),
    );
    expect(broken.diagnostics.some((item) => item.code === "reference.missing")).toBe(
      true,
    );

    const wrongType = parseAndValidateHandoverV11(
      fixture.replace(
        "skill_ref: skill-react",
        "skill_ref: fact-education-msc-tud",
      ),
    );
    expect(wrongType.diagnostics.some((item) => item.code === "reference.type")).toBe(
      true,
    );
  });

  it("rejects confirmed lifecycle and malformed YAML", () => {
    const confirmed = parseAndValidateHandoverV11(
      fixture.replace("status: proposed", "status: confirmed"),
    );
    expect(
      confirmed.diagnostics.some(
        (item) =>
          item.code === "lifecycle.not_proposed",
      ),
    ).toBe(true);

    const malformed = parseAndValidateHandoverV11(
      fixture.replace("confidence: high", "confidence high"),
    );
    expect(malformed.diagnostics.some((item) => item.code === "yaml.malformed")).toBe(
      true,
    );
  });

  it("rejects missing required fields and unknown fields", () => {
    const missing = parseAndValidateHandoverV11(
      fixture.replace(
        "statement: Completed an MSc in Creative Digital Media and UX at Example University with First Class Honours.",
        "",
      ),
    );
    expect(missing.diagnostics.some((item) => item.code === "record.invalid")).toBe(
      true,
    );

    const unknown = parseAndValidateHandoverV11(
      fixture.replace(
        "category: education",
        "category: education\nunapproved_field: unsafe",
      ),
    );
    expect(unknown.diagnostics.some((item) => item.code === "record.invalid")).toBe(
      true,
    );
  });

  it("reports unclosed fences without executing YAML features", () => {
    const unclosed = `${minimalDocument()}\n\`\`\`yaml\ntype: stable_fact\n`;
    expect(
      parseAndValidateHandoverV11(unclosed).diagnostics.some(
        (item) => item.code === "yaml.unclosed_fence",
      ),
    ).toBe(true);

    const unsafe = fixture.replace(
      "confidence: high",
      "confidence: &anchor high",
    );
    expect(
      parseAndValidateHandoverV11(unsafe).diagnostics.some(
        (item) => item.code === "yaml.malformed",
      ),
    ).toBe(true);
  });

  it("enforces frozen mode semantics", () => {
    const primary = parseAndValidateHandoverV11(
      fixture.replace(
        "prohibited_role_families: []",
        "prohibited_role_families:\n- Pure Backend Engineer",
      ),
    );
    expect(
      primary.diagnostics.some(
        (item) => item.code === "mode.primary_unsupported_prohibition",
      ),
    ).toBe(true);

    const temporary = parseAndValidateHandoverV11(
      fixture.replace("role: Non-sales Customer Success", "role: Customer Success"),
    );
    expect(
      temporary.diagnostics.some(
        (item) => item.code === "mode.temporary_customer_success",
      ),
    ).toBe(true);
  });
});

function minimalDocument(): string {
  return `---
format: waypoint-career-handover
version: "1.1"
generated_at: 2026-07-24T15:00:00Z
subject: user
generator: test
---

${HANDOVER_V11_SECTIONS.map((section) => `# ${section}\n\nNo supported records found.`).join("\n\n")}`;
}
