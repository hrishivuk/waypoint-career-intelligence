import type { JobAnalysisResult } from "./contracts";

export type RecommendationPresentation = Readonly<{
  label: string;
  tone: "success" | "warning" | "danger";
  description: string;
}>;

const recommendationPresentation = {
  apply: {
    label: "Worth applying",
    tone: "success",
    description: "The confirmed evidence supports pursuing this role.",
  },
  investigate: {
    label: "Investigate first",
    tone: "warning",
    description: "Resolve the important unknowns before deciding.",
  },
  skip: {
    label: "Probably skip",
    tone: "danger",
    description: "The confirmed evidence points away from this role.",
  },
} as const satisfies Record<
  JobAnalysisResult["recommendation"],
  RecommendationPresentation
>;

export function getRecommendationPresentation(
  recommendation: JobAnalysisResult["recommendation"],
): RecommendationPresentation {
  return recommendationPresentation[recommendation];
}

export function formatJobAnalysisDate(
  value: string | Date | null | undefined,
  options: { locale?: string; timeZone?: string } = {},
) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "Date unavailable";

  try {
    return new Intl.DateTimeFormat(options.locale ?? "en", {
      dateStyle: "medium",
      timeZone: options.timeZone ?? "UTC",
    }).format(date);
  } catch {
    return "Date unavailable";
  }
}

export function formatJobAnalysisScore(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    return "Score unavailable";
  }

  return `${Math.round(value)}/100`;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function getJobDisplayIdentity(input: {
  title?: string | null;
  company?: string | null;
}) {
  return {
    title: cleanDisplayValue(input.title) ?? "Untitled role",
    company: cleanDisplayValue(input.company) ?? "Company not identified",
  };
}

export function uniqueTextItems(values: readonly string[]) {
  const seen = new Set<string>();
  return values.reduce<string[]>((items, value) => {
    const cleaned = value.trim();
    const identity = cleaned.toLocaleLowerCase();
    if (!cleaned || seen.has(identity)) return items;
    seen.add(identity);
    items.push(cleaned);
    return items;
  }, []);
}

function cleanDisplayValue(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}
