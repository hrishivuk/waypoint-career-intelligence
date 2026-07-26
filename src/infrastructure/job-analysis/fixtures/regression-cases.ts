export interface JobAnalysisRegressionCase {
  id: string;
  description: string;
  expected: {
    concepts: string[];
    unknowns: string[];
    blockers: string[];
    recommendation: "apply" | "investigate" | "skip";
  };
}

/**
 * Anonymised behavioural fixtures. They intentionally describe expectations
 * rather than freezing model wording.
 */
export const jobAnalysisRegressionCases: JobAnalysisRegressionCase[] = [
  {
    id: "frontend-product-role",
    description:
      "Build accessible customer-facing React and TypeScript interfaces, collaborate with UX, improve performance, and contribute to a design system. React Native is beneficial.",
    expected: {
      concepts: ["React", "TypeScript", "Accessibility", "UX", "Design Systems"],
      unknowns: [],
      blockers: [],
      recommendation: "apply",
    },
  },
  {
    id: "ai-native-role",
    description:
      "Use AI coding tools such as Cursor, Codex and MCP in a daily development workflow. Navigate an established codebase and collaborate across product and engineering.",
    expected: {
      concepts: [
        "AI-Assisted Development",
        "Codebase Navigation",
        "Cross-functional Collaboration",
      ],
      unknowns: ["Daily frequency when not explicitly evidenced"],
      blockers: [],
      recommendation: "investigate",
    },
  },
  {
    id: "mixed-backend-frontend-role",
    description:
      "Professional Java and Spring production experience is required. React, TypeScript, REST APIs and SQL are also used by the team.",
    expected: {
      concepts: ["Java", "Spring", "React", "TypeScript", "REST APIs", "SQL"],
      unknowns: ["Professional Java/Spring production experience"],
      blockers: [],
      recommendation: "investigate",
    },
  },
  {
    id: "location-eligibility-role",
    description:
      "The employee must already hold permission to work in the stated country and attend the Lisbon office three days each week.",
    expected: {
      concepts: ["Work authorisation", "Lisbon hybrid attendance"],
      unknowns: ["Lisbon attendance feasibility"],
      blockers: [],
      recommendation: "investigate",
    },
  },
];
