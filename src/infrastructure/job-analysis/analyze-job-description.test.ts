import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let assessRequirement: typeof import("./analyze-job-description").assessRequirement;
let applySemanticMatch: typeof import("./analyze-job-description").applySemanticMatch;
let selectBestCv: typeof import("./analyze-job-description").selectBestCv;

beforeAll(async () => {
  ({ assessRequirement, applySemanticMatch, selectBestCv } = await import(
    "./analyze-job-description"
  ));
});

function requirement(text: string) {
  return {
    text,
    kind: "skill" as const,
    priority: "required" as const,
    normalizedValue: null,
    minimumYears: null,
    evidence: {
      source: {
        quote: text,
        startCharacter: 0,
        endCharacter: text.length,
      },
      confidence: 0.95,
    },
  };
}

function knowledge(input: {
  level?: string;
  aliases?: string[];
  competency?: { name: string; level: string };
}) {
  return {
    skills: input.level
      ? [{ id: "skill-1", name: "React", aliases: input.aliases ?? [] }]
      : [],
    evidence: [],
    capabilityLevels: new Map(
      input.level ? [["skill-1", input.level]] : [],
    ),
    competencies: input.competency
      ? [{ id: "competency-1", name: input.competency.name }]
      : [],
    competencyLevels: new Map(
      input.competency
        ? [["competency-1", input.competency.level]]
        : [],
    ),
    modes: [],
    preferences: [],
    fingerprint: "test",
    cvs: [],
  };
}

describe("Skill Model v2 job matching", () => {
  it("selects a CV by visible snapshot content, not global knowledge links", () => {
    const requirements = [
      {
        text: "Strong React and TypeScript experience",
        kind: "skill",
        required: true,
        match: "matched" as const,
        score: 85,
        explanation: "Supported",
        evidence: ["Skill: React", "Skill: TypeScript"],
        outcome: "supported" as const,
        criticality: "mandatory_core" as const,
        confidence: 0.9,
        matchedSkillIds: ["react", "typescript"],
        matchedEvidenceIds: [],
      },
    ];
    const selected = selectBestCv(
      [
        {
          id: "frontend",
          name: "Frontend CV",
          is_primary: false,
          intended_roles: ["Frontend Engineer"],
          snapshotStatus: "ready",
          snapshotText: "react typescript component interfaces",
        },
        {
          id: "design",
          name: "Design CV",
          is_primary: true,
          intended_roles: ["UI Designer"],
          snapshotStatus: "ready",
          snapshotText: "figma wireframes prototyping",
        },
      ],
      requirements,
      "Frontend Engineer",
    );

    expect(selected?.id).toBe("frontend");
    expect(selected?.reason).toContain("visibly represented");
    expect(selected?.representedCount).toBe(1);
    expect(selected?.relevantCount).toBe(1);
    expect(selected?.representedRequirements).toEqual([
      "Strong React and TypeScript experience",
    ]);
  });

  it("does not recommend a CV whose ATS snapshot failed", () => {
    const selected = selectBestCv(
      [{
        id: "failed",
        name: "Failed CV",
        is_primary: false,
        intended_roles: ["Frontend Engineer"],
        snapshotStatus: "failed",
        snapshotText: "",
      }],
      [],
      "Frontend Engineer",
    );

    expect(selected).toBeNull();
  });

  it("uses reviewed proficiency levels when scoring a skill", () => {
    const strong = assessRequirement(
      requirement("Strong React experience"),
      knowledge({ level: "strong" }) as never,
    );
    const basic = assessRequirement(
      requirement("Strong React experience"),
      knowledge({ level: "basic" }) as never,
    );

    expect(strong.match).toBe("matched");
    expect(strong.score).toBe(85);
    expect(strong.evidence).toContain("Skill: React (Strong)");
    expect(basic.match).toBe("partial");
    expect(basic.score).toBe(45);
  });

  it("matches reviewed professional competencies", () => {
    const result = assessRequirement(
      requirement(
        "Collaborate effectively with cross-functional teams.",
      ),
      knowledge({
        competency: {
          name: "Cross-functional Collaboration",
          level: "strong",
        },
      }) as never,
    );

    expect(result.match).toBe("matched");
    expect(result.score).toBe(85);
    expect(result.evidence).toContain(
      "Competency: Cross-functional Collaboration (Strong)",
    );
  });

  it("recognises a reviewed skill alias", () => {
    const result = assessRequirement(
      requirement("Professional experience building interfaces with ReactJS"),
      knowledge({ level: "strong", aliases: ["ReactJS"] }) as never,
    );

    expect(result.match).toBe("matched");
    expect(result.score).toBe(85);
  });

  it("uses confirmed codebase-navigation evidence for technical debt", () => {
    const storedKnowledge = {
      ...knowledge({}),
      evidence: [
        {
          id: "evidence-codebase",
          title: "Codebase navigation",
          narrative:
            "Navigated existing living codebases and managed technical debt at Experion Technologies and PixelForge.",
          organisation: "Experion Technologies; PixelForge",
          attributes: {},
        },
      ],
    };
    const result = assessRequirement(
      {
        ...requirement(
          "Navigate an existing, living codebase and manage technical debt",
        ),
        kind: "experience" as const,
      },
      storedKnowledge as never,
    );

    expect(result.match).toBe("matched");
    expect(result.score).toBe(75);
    expect(result.evidence).toContain("Codebase navigation");
  });

  it("allows AI to map a versioned requirement to a cited canonical skill", () => {
    const input = requirement("Build interfaces using React 19");
    const storedKnowledge = knowledge({ level: "strong" });
    const deterministic = assessRequirement(input, storedKnowledge as never);
    const result = applySemanticMatch(
      input,
      deterministic,
      {
        requirementId: "requirement-0",
        aspects: [
          {
            text: "React 19",
            status: "supported",
            citations: [
              {
                recordId: "skill-1",
                relation: "version_variant",
                confidence: 0.98,
              },
            ],
          },
        ],
      },
      storedKnowledge as never,
    );

    expect(result.match).toBe("matched");
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.evidence[0]).toContain("covers the named version");
  });

  it("never lets semantic output downgrade verified deterministic evidence", () => {
    const input = requirement("Strong React experience");
    const storedKnowledge = knowledge({ level: "strong" });
    const deterministic = assessRequirement(input, storedKnowledge as never);
    const result = applySemanticMatch(
      input,
      deterministic,
      {
        requirementId: "requirement-0",
        aspects: [
          {
            text: "React",
            status: "unsupported",
            citations: [],
          },
        ],
      },
      storedKnowledge as never,
    );

    expect(result.match).toBe("matched");
    expect(result.score).toBe(deterministic.score);
    expect(result.evidence).toEqual(deterministic.evidence);
  });

  it("does not let undated evidence prove a stated duration", () => {
    const input = {
      ...requirement("At least 3 years of frontend development"),
      kind: "experience" as const,
      minimumYears: 3,
    };
    const storedKnowledge = {
      ...knowledge({}),
      evidence: [
        {
          id: "frontend-evidence",
          title: "Frontend development",
          narrative: "Built frontend products professionally.",
          organisation: "Example",
          attributes: {},
        },
      ],
    };

    const result = assessRequirement(input, storedKnowledge as never);

    expect(result.match).not.toBe("matched");
    expect(result.score).toBeLessThan(75);
  });

  it("accepts semantic AI-tool matching only when it cites stored knowledge", () => {
    const input = requirement(
      "Use AI tools daily, including Cursor, Claude, Codex and MCP",
    );
    const storedKnowledge = {
      ...knowledge({}),
      skills: [
        {
          id: "ai-skill",
          name: "AI-Assisted Development",
          aliases: ["AI coding tools"],
        },
      ],
      capabilityLevels: new Map([["ai-skill", "strong"]]),
    };
    const deterministic = assessRequirement(input, storedKnowledge as never);
    const cited = applySemanticMatch(
      input,
      deterministic,
      {
        requirementId: "requirement-0",
        aspects: [
          {
            text: "Daily AI-assisted development workflow",
            status: "supported",
            citations: [
              {
                recordId: "ai-skill",
                relation: "parent_child",
                confidence: 0.9,
              },
            ],
          },
        ],
      },
      storedKnowledge as never,
    );
    const invented = applySemanticMatch(
      input,
      deterministic,
      {
        requirementId: "requirement-0",
        aspects: [
          {
            text: "Daily AI-assisted development workflow",
            status: "supported",
            citations: [
              {
                recordId: "invented-record",
                relation: "direct",
                confidence: 1,
              },
            ],
          },
        ],
      },
      storedKnowledge as never,
    );

    expect(cited.match).toBe("matched");
    expect(invented.match).toBe("uncertain");
    expect(invented.outcome).toBe("unknown");
    expect(invented.evidence).toEqual([]);
  });
});
