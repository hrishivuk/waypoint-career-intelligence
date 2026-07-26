export type KnowledgeStatus =
  | "proposed"
  | "confirmed"
  | "rejected"
  | "superseded"
  | "stale";

export type DatePrecision = "year" | "month" | "day";

export interface PreciseDate {
  value: string;
  precision: DatePrecision;
}

/** Plain strings remain accepted for persisted v1 records. */
export type LifecycleDate = string | PreciseDate;
export type KnowledgeCriticality = "normal" | "important" | "critical";

export type KnowledgeSourceType =
  | "user_input"
  | "cv"
  | "chat_handover"
  | "analysis_feedback"
  | "system_observation";

export interface KnowledgeSource {
  type: KnowledgeSourceType;
  reference: string;
  capturedAt: string;
  excerpt?: string;
}

export interface TemporalLifecycle {
  status: KnowledgeStatus;
  confidence: number;
  validFrom?: LifecycleDate;
  validUntil?: LifecycleDate;
  lastConfirmedAt?: LifecycleDate;
  reviewAfter?: LifecycleDate;
  criticality?: KnowledgeCriticality;
  sources: KnowledgeSource[];
  tags: string[];
}

export type TemporalKnowledgeClass =
  | "permanent_evidence"
  | "slowly_changing"
  | "critical_constraint"
  | "temporary_state"
  | "historical";

export type KnowledgeInfluence =
  | "active"
  | "active_with_warning"
  | "requires_confirmation"
  | "inactive";

export function knowledgeInfluence(
  lifecycle: TemporalLifecycle,
  knowledgeClass: TemporalKnowledgeClass,
  now: Date,
): KnowledgeInfluence {
  if (lifecycle.status !== "confirmed") return "inactive";

  const nowMs = now.getTime();
  if (
    lifecycle.validFrom &&
    preciseDateBoundary(lifecycle.validFrom, "start") > nowMs
  ) {
    return "inactive";
  }

  const expired =
    lifecycle.validUntil !== undefined &&
    preciseDateBoundary(lifecycle.validUntil, "end") < nowMs;
  const reviewDue =
    lifecycle.reviewAfter !== undefined &&
    preciseDateBoundary(lifecycle.reviewAfter, "end") < nowMs;

  if (
    lifecycle.criticality === "critical" &&
    knowledgeClass !== "permanent_evidence" &&
    (!lifecycle.validUntil && !lifecycle.reviewAfter)
  ) {
    return "requires_confirmation";
  }

  if (knowledgeClass === "permanent_evidence") return "active";
  if (knowledgeClass === "historical") return "inactive";
  if (knowledgeClass === "temporary_state") {
    if (expired) return "inactive";
    if (reviewDue) {
      return lifecycle.criticality === "critical"
        ? "requires_confirmation"
        : "active_with_warning";
    }
    return "active";
  }
  if (knowledgeClass === "critical_constraint") {
    return expired || reviewDue ? "requires_confirmation" : "active";
  }
  return expired || reviewDue ? "active_with_warning" : "active";
}

export function validatePreciseDate(date: PreciseDate): boolean {
  const patterns: Record<DatePrecision, RegExp> = {
    year: /^\d{4}$/,
    month: /^\d{4}-(0[1-9]|1[0-2])$/,
    day: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  };
  if (!patterns[date.precision].test(date.value)) return false;
  if (date.precision === "day") {
    const parsed = new Date(`${date.value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === date.value;
  }
  return true;
}

export function preciseDateBoundary(
  date: LifecycleDate,
  boundary: "start" | "end",
): number {
  if (typeof date === "string") return new Date(date).getTime();
  if (!validatePreciseDate(date)) return Number.NaN;
  const start =
    date.precision === "year"
      ? `${date.value}-01-01`
      : date.precision === "month"
        ? `${date.value}-01`
        : date.value;
  if (boundary === "start") return new Date(`${start}T00:00:00.000Z`).getTime();
  const parts = start.split("-").map(Number);
  const year = parts[0];
  const month = parts[1] ?? 12;
  const day = parts[2];
  const endDay = day ?? new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Date.UTC(year, month - 1, endDay, 23, 59, 59, 999);
}

export function assertConfidence(confidence: number): void {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Knowledge confidence must be between 0 and 1.");
  }
}
