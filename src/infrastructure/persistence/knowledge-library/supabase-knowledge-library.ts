import "server-only";

import type {
  KnowledgeLibraryItem,
  KnowledgeLibrarySection,
} from "@/application/knowledge-library";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

interface SectionDefinition {
  table: string;
  key: string;
  title: string;
  description: string;
  titleFields: string[];
  summaryFields: string[];
  include?: (row: Record<string, unknown>) => boolean;
}

const definitions: SectionDefinition[] = [
  {
    table: "career_profile_facts",
    key: "stable-facts",
    title: "Stable facts",
    description: "Core facts such as education, eligibility and established background.",
    titleFields: ["fact_key", "category"],
    summaryFields: ["value"],
  },
  {
    table: "career_modes",
    key: "career-modes",
    title: "Career directions",
    description: "The different career paths and priorities Waypoint considers.",
    titleFields: ["name", "slug"],
    summaryFields: ["purpose"],
  },
  {
    table: "typed_preferences",
    key: "preferences",
    title: "Preferences & constraints",
    description: "How you prefer to work and the conditions that affect decisions.",
    titleFields: ["subject", "record_type"],
    summaryFields: ["reason", "value"],
  },
  {
    table: "decision_policies",
    key: "decision-policies",
    title: "Decision rules",
    description: "Rules Waypoint should apply when judging jobs and next actions.",
    titleFields: ["policy_type"],
    summaryFields: ["rule_text"],
  },
  {
    table: "evidence_records",
    key: "projects",
    title: "Projects",
    description: "Products and project work that demonstrate what you can build.",
    titleFields: ["title"],
    summaryFields: ["narrative"],
    include: (row) => ["project", "design_work"].includes(String(row.kind)),
  },
  {
    table: "evidence_records",
    key: "evidence",
    title: "Experience & evidence",
    description: "Employment, education, projects and achievements supporting your profile.",
    titleFields: ["title", "kind"],
    summaryFields: ["organisation", "narrative"],
    include: (row) => !["project", "design_work"].includes(String(row.kind)),
  },
  {
    table: "skills",
    key: "skills",
    title: "Skills",
    description: "Skills found in your confirmed history and CVs.",
    titleFields: ["name"],
    summaryFields: ["category", "description"],
  },
  {
    table: "professional_competencies",
    key: "competencies",
    title: "Professional competencies",
    description:
      "Collaboration, delivery and working-style capabilities used in job decisions.",
    titleFields: ["name"],
    summaryFields: ["category", "description"],
  },
  {
    table: "capability_assessments",
    key: "capabilities",
    title: "Capability assessments",
    description: "Explicit assessments of skill level, separate from simple skill mentions.",
    titleFields: ["current_level"],
    summaryFields: ["context", "development_objective"],
  },
  {
    table: "historical_observations",
    key: "history",
    title: "Past observations",
    description: "Patterns learned from previous career discussions and outcomes.",
    titleFields: ["observation_type"],
    summaryFields: ["observation"],
  },
  {
    table: "temporary_states",
    key: "temporary",
    title: "Temporary context",
    description: "Time-limited circumstances that may affect recommendations.",
    titleFields: ["state_type"],
    summaryFields: ["value"],
  },
  {
    table: "knowledge_uncertainties",
    key: "uncertainties",
    title: "Unknowns to resolve",
    description: "Information Waypoint knows is uncertain or needs clarification.",
    titleFields: ["topic"],
    summaryFields: ["description", "resolution_needed"],
  },
];

export async function loadKnowledgeLibrary(
  userId: string,
  sectionKeys?: readonly string[],
): Promise<KnowledgeLibrarySection[]> {
  const client = getSupabaseServerClient();
  const { data: masterProfile, error: masterProfileError } = await client
    .from("master_profile_records")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });
  if (masterProfileError) {
    throw new Error("Unable to load the Master Profile.", {
      cause: masterProfileError,
    });
  }
  if ((masterProfile ?? []).length > 0) {
    return masterProfileSections(
      masterProfile as Record<string, unknown>[],
      sectionKeys,
    );
  }
  const selected = sectionKeys
    ? sectionKeys
        .map((key) => definitions.find((definition) => definition.key === key))
        .filter((definition): definition is SectionDefinition =>
          Boolean(definition),
        )
    : definitions;
  const sections = await Promise.all(
    selected.map(async (definition) => {
      const { data, error } = await client
        .from(definition.table)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) {
        throw new Error(`Unable to load ${definition.title}.`, { cause: error });
      }
      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        items: (data ?? [])
          .filter((row) => !definition.include || definition.include(row))
          .map((row) => mapItem(row, definition)),
      };
    }),
  );
  const skillSection = sections.find((section) => section.key === "skills");
  if (skillSection) {
    const { data, error } = await client
      .from("capability_assessments")
      .select("id,skill_id,current_level,target_level,context,confidence")
      .eq("user_id", userId)
      .eq("status", "confirmed");
    if (error) {
      throw new Error("Unable to load skill levels.", { cause: error });
    }
    const levels = new Map(
      (data ?? []).map((assessment) => [
        String(assessment.skill_id),
        assessment as Record<string, unknown>,
      ]),
    );
    skillSection.items = skillSection.items.map((item) => ({
      ...item,
      details: {
        ...item.details,
        capability: levels.get(item.id) ?? null,
      },
    }));
  }
  const competencySection = sections.find(
    (section) => section.key === "competencies",
  );
  if (competencySection) {
    const { data, error } = await client
      .from("competency_assessments")
      .select("id,competency_id,proficiency_level,context,assessment_confidence")
      .eq("user_id", userId)
      .eq("status", "confirmed");
    if (error) {
      throw new Error("Unable to load competency levels.", { cause: error });
    }
    const levels = new Map(
      (data ?? []).map((assessment) => [
        String(assessment.competency_id),
        {
          ...assessment,
          current_level: assessment.proficiency_level,
        } as Record<string, unknown>,
      ]),
    );
    competencySection.items = competencySection.items.map((item) => ({
      ...item,
      details: {
        ...item.details,
        capability: levels.get(item.id) ?? null,
      },
    }));
  }
  return sections;
}

function masterProfileSections(
  records: Record<string, unknown>[],
  sectionKeys?: readonly string[],
): KnowledgeLibrarySection[] {
  const sections = [
    {
      key: "skills",
      title: "Skills",
      description: "Confirmed technical and design capabilities with assessed levels.",
      types: ["skill"],
    },
    {
      key: "competencies",
      title: "Professional competencies",
      description: "Working-style, collaboration and product capabilities.",
      types: ["competency"],
    },
    {
      key: "projects",
      title: "Projects",
      description: "Products and portfolio work demonstrating applied capability.",
      types: ["project"],
    },
    {
      key: "evidence",
      title: "Experience & evidence",
      description: "Employment, education and achievements supporting the profile.",
      types: ["experience", "education", "achievement"],
    },
    {
      key: "stable-facts",
      title: "Stable facts",
      description: "Established background and eligibility information.",
      types: ["stable_fact", "eligibility"],
    },
    {
      key: "career-modes",
      title: "Career directions",
      description: "Roles, domains and development directions under consideration.",
      types: ["career_direction"],
    },
    {
      key: "preferences",
      title: "Preferences & constraints",
      description: "Conditions and priorities affecting career decisions.",
      types: ["preference"],
    },
    {
      key: "decision-policies",
      title: "Decision rules",
      description: "Confirmed policies used when evaluating opportunities.",
      types: ["decision_policy"],
    },
  ];
  return sections
    .filter((section) => !sectionKeys || sectionKeys.includes(section.key))
    .map((section) => ({
      key: section.key,
      title: section.title,
      description: section.description,
      items: records
        .filter((record) => section.types.includes(String(record.record_type)))
        .map((record) => {
          const structured =
            record.structured_data &&
            typeof record.structured_data === "object" &&
            !Array.isArray(record.structured_data)
              ? (record.structured_data as Record<string, unknown>)
              : {};
          return {
            id: String(record.id),
            title: String(record.title),
            summary: String(record.statement),
            status: String(record.status ?? "confirmed"),
            confidence:
              typeof record.confidence === "number"
                ? record.confidence
                : Number(record.confidence),
            sourceType: "career_narrative",
            tags: Array.isArray(structured.tags)
              ? structured.tags.filter(
                  (tag): tag is string => typeof tag === "string",
                )
              : [],
            details: {
              ...record,
              capability:
                record.record_type === "skill"
                  ? {
                      current_level: structured.proficiency ?? null,
                      context: structured.proficiencyBasis ?? null,
                    }
                  : null,
            },
          };
        }),
    }));
}

function mapItem(
  row: Record<string, unknown>,
  definition: SectionDefinition,
): KnowledgeLibraryItem {
  const presentation = presentRow(row, definition);
  return {
    id: String(row.id),
    title: presentation.title,
    summary: presentation.summary,
    status: typeof row.status === "string" ? row.status : "stored",
    confidence:
      typeof row.confidence === "number" ? row.confidence : null,
    sourceType:
      typeof row.source_type === "string" ? row.source_type : null,
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    details: row,
  };
}

function presentRow(
  row: Record<string, unknown>,
  definition: SectionDefinition,
) {
  if (definition.table === "career_profile_facts") {
    const statement =
      nestedString(row.value, "statement") ??
      displayValue(row.value) ??
      "Stored personal fact";
    return {
      title: statement,
      summary: humanise(String(row.category ?? "Stable fact")),
    };
  }
  if (definition.table === "typed_preferences") {
    return {
      title: humanise(String(row.subject ?? row.record_type ?? "Preference")),
      summary:
        stringValue(row.reason) ??
        displayValue(row.value) ??
        "Stored preference",
    };
  }
  if (definition.table === "decision_policies") {
    return {
      title: humanise(String(row.policy_type ?? "Decision rule")),
      summary: stringValue(row.rule_text),
    };
  }
  if (definition.table === "capability_assessments") {
    return {
      title: `Capability level: ${humanise(String(row.current_level ?? "Unknown"))}`,
      summary:
        stringValue(row.context) ??
        stringValue(row.development_objective),
    };
  }
  return {
    title: humanise(
      firstDisplayValue(row, definition.titleFields) ?? "Untitled record",
    ),
    summary: firstDisplayValue(row, definition.summaryFields),
  };
}

function firstDisplayValue(
  row: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value !== null && typeof value === "object") {
      return displayValue(value);
    }
  }
  return null;
}

function nestedString(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return stringValue((value as Record<string, unknown>)[key]);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function displayValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const displayed = value.map(displayValue).filter(Boolean);
    return displayed.length ? displayed.join(", ") : null;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return (
      nestedString(record, "statement") ??
      nestedString(record, "value") ??
      Object.values(record).map(displayValue).find(Boolean) ??
      null
    );
  }
  return value === null || value === undefined ? null : String(value);
}

function humanise(value: string) {
  return value
    .replace(/^handover:/, "")
    .replace(/^(?:fact|preference|policy|evidence|skill)-/, "")
    .replaceAll(/[-_:]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
