import type { TemporalLifecycle } from "./lifecycle";

export type PreferenceStrength =
  | "required"
  | "strongly_preferred"
  | "preferred"
  | "neutral"
  | "undesirable"
  | "prohibited";

export interface CareerPreference extends TemporalLifecycle {
  id: string;
  candidateId: string;
  kind: "preference" | "constraint";
  subject: string;
  value: string | OrderedPreferenceValue;
  strength: PreferenceStrength;
  reason: string;
  exceptions: string[];
  careerModeId?: string;
}

export interface OrderedPreferenceValue {
  kind: "ordered";
  values: string[];
}

export function validatePreferenceValue(
  value: CareerPreference["value"],
): string[] {
  if (typeof value === "string") {
    return value.includes(",")
      ? ["Scalar preference values must be atomic; use an ordered value."]
      : value.trim()
        ? []
        : ["Preference value must not be empty."];
  }
  if (
    value.kind !== "ordered" ||
    value.values.length < 2 ||
    value.values.some((item) => !item.trim() || item.includes(","))
  ) {
    return ["Ordered preferences require at least two atomic values."];
  }
  return new Set(value.values).size === value.values.length
    ? []
    : ["Ordered preference values must be unique."];
}

export const PREFERENCE_SCORE_MODIFIER: Record<PreferenceStrength, number> = {
  required: 30,
  strongly_preferred: 18,
  preferred: 10,
  neutral: 0,
  undesirable: -12,
  prohibited: -100,
};

export function isConfirmedHardPreference(
  preference: CareerPreference,
): boolean {
  return (
    preference.status === "confirmed" &&
    (preference.strength === "required" ||
      preference.strength === "prohibited")
  );
}
