"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Confidence = "low" | "medium" | "high";
type Criticality = "normal" | "important" | "critical";
type ReviewStatus =
  | "proposed"
  | "pending"
  | "confirmed"
  | "rejected"
  | "corrected"
  | "superseded"
  | "stale";

type ReviewCandidate = {
  id: string;
  stableRecordId: string;
  recordType: string;
  exactRecord: Record<string, unknown>;
  effectiveRecord: Record<string, unknown>;
  correctedRecord?: Record<string, unknown>;
  section?: string;
  reviewStatus: ReviewStatus;
  version: number;
  confidence?: Confidence;
  criticality?: Criticality;
  provenance?: {
    sourceType?: string;
    sourceRef?: string;
    source_type?: string;
    source_ref?: string;
    basis: string;
  };
  sourceOrder: number;
  projectionStatus?: string;
  projection?: {
    status: string;
    targetType?: string;
    message?: string;
    projectedAt?: string;
  };
};

type ReviewAction = "confirm" | "reject" | "correct";
type RequestState = "loading" | "idle";

const reviewApi = "/api/v1/knowledge/review";

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string | { message?: string };
      message?: string;
    };
    if (typeof payload.error === "string") return payload.error;
    return (
      payload.error?.message ??
      payload.message ??
      `Request failed (${response.status})`
    );
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

function candidatesFromResponse(
  response:
    | ReviewCandidate[]
    | {
        candidates?: ReviewCandidate[];
        candidate?: ReviewCandidate;
      },
): ReviewCandidate[] {
  if (Array.isArray(response)) return response;
  if (response.candidates) return response.candidates;
  if (response.candidate) return [response.candidate];
  return [];
}

function readableLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function projectionBadge(status: string): string {
  switch (status) {
    case "projected":
    case "complete":
      return "border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]";
    case "blocked":
    case "failed":
      return "border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]";
    case "pending":
      return "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function recordSummary(candidate: ReviewCandidate): string {
  const record = candidate.effectiveRecord ?? candidate.exactRecord;
  const keys = [
    "statement",
    "rule",
    "description",
    "summary",
    "observation",
    "context",
    "name",
    "title",
    "value",
    "purpose",
  ];
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  if (Array.isArray(record.ordered_values)) {
    const ranking = record.ordered_values.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const entry = item as Record<string, unknown>;
      return typeof entry.value === "string" &&
        typeof entry.rank === "number"
        ? [`${entry.rank}. ${entry.value}`]
        : [];
    });
    if (ranking.length > 0) {
      const subject =
        typeof record.subject === "string"
          ? `${readableLabel(record.subject)}: `
          : "";
      return `${subject}${ranking.join(" → ")}`;
    }
  }

  if (
    typeof record.skill_ref === "string" &&
    typeof record.current_level === "string"
  ) {
    return `${readableLabel(record.skill_ref.replace(/^skill-/, ""))}: ${readableLabel(record.current_level)}`;
  }

  return `Structured ${readableLabel(candidate.recordType)} record. Use Correct to inspect or edit its full details.`;
}

function recordMetadata(candidate: ReviewCandidate) {
  const record = candidate.effectiveRecord ?? candidate.exactRecord;
  const recordProvenance =
    record.provenance &&
    typeof record.provenance === "object" &&
    !Array.isArray(record.provenance)
      ? (record.provenance as Record<string, unknown>)
      : {};
  const confidence =
    candidate.confidence ??
    (["low", "medium", "high"].includes(String(record.confidence))
      ? (record.confidence as Confidence)
      : "low");
  const criticality =
    candidate.criticality ??
    (["normal", "important", "critical"].includes(String(record.criticality))
      ? (record.criticality as Criticality)
      : "normal");

  return {
    confidence,
    criticality,
    provenance: {
      basis: String(
        candidate.provenance?.basis ?? recordProvenance.basis ?? "unknown",
      ),
      sourceType: String(
        candidate.provenance?.sourceType ??
          candidate.provenance?.source_type ??
          recordProvenance.source_type ??
          "unknown",
      ),
      sourceRef: String(
        candidate.provenance?.sourceRef ??
          candidate.provenance?.source_ref ??
          recordProvenance.source_ref ??
          "Not specified",
      ),
    },
  };
}

export function KnowledgeReview() {
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    setRequestState("loading");
    setError(null);
    try {
      const response = await requestJson<
        ReviewCandidate[] | { importRun: unknown; candidates: ReviewCandidate[] }
      >(reviewApi);
      setCandidates(candidatesFromResponse(response));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load imported knowledge.",
      );
    } finally {
      setRequestState("idle");
    }
  }, []);

  useEffect(() => {
    let active = true;

    void requestJson<
      ReviewCandidate[] | { importRun: unknown; candidates: ReviewCandidate[] }
    >(reviewApi)
      .then((response) => {
        if (active) setCandidates(candidatesFromResponse(response));
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load imported knowledge.",
          );
        }
      })
      .finally(() => {
        if (active) setRequestState("idle");
      });

    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, ReviewCandidate[]>();
    for (const candidate of candidates) {
      const key = candidate.section?.trim() || candidate.recordType;
      grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
    }
    return [...grouped.entries()].map(
      ([key, items]) =>
        [
          key,
          items.toSorted((left, right) => left.sourceOrder - right.sourceOrder),
        ] as const,
    );
  }, [candidates]);

  async function reviewCandidate(
    candidate: ReviewCandidate,
    action: ReviewAction,
    correctedRecord?: Record<string, unknown>,
  ) {
    setPendingId(candidate.id);
    setError(null);
    try {
      const response = await requestJson<
        ReviewCandidate | { candidate: ReviewCandidate }
      >(`${reviewApi}/${encodeURIComponent(candidate.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          expectedVersion: candidate.version,
          ...(action === "correct" ? { correctedRecord } : {}),
        }),
      });
      const updated = candidatesFromResponse(
        "id" in response ? [response] : response,
      )[0];
      if (!updated) throw new Error("The review response was empty.");
      setCandidates((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save that review decision.",
      );
    } finally {
      setPendingId(null);
    }
  }

  const proposedCount = candidates.filter(
    (candidate) =>
      candidate.reviewStatus === "proposed" ||
      candidate.reviewStatus === "pending",
  ).length;

  return (
    <section aria-labelledby="review-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="review-heading" className="text-xl font-semibold text-foreground">
            Staged candidates
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {proposedCount} awaiting review · {candidates.length} total
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void loadCandidates()}
          disabled={requestState === "loading" || pendingId !== null}
          variant="outline"
        >
          Refresh
        </Button>
      </div>

      <div aria-live="polite">
        {error ? (
          <Alert variant="destructive" className="mb-5 p-4">
            <AlertDescription>{error}</AlertDescription>
            <Button
              type="button"
              onClick={() => void loadCandidates()}
              variant="link"
              className="mt-2 justify-start px-0 text-destructive"
            >
              Try loading again
            </Button>
          </Alert>
        ) : null}

        {requestState === "loading" ? (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-xs">
            Loading imported knowledge…
          </p>
        ) : null}

        {requestState === "idle" && candidates.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <h3 className="font-medium text-foreground">
              Nothing is waiting for review
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Staged handover records will appear here before they can become
              trusted knowledge.
            </p>
          </div>
        ) : null}
      </div>

      {requestState === "idle" && candidates.length > 0 ? (
        <div className="space-y-9">
          {groups.map(([group, items]) => (
            <section key={group} aria-labelledby={`group-${group}`}>
              <div className="border-b border-border pb-2">
                <h3
                  id={`group-${group}`}
                  className="font-semibold text-foreground"
                >
                  {readableLabel(group)}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? "record" : "records"}
                </p>
              </div>
              <ul className="mt-3 space-y-3">
                {items.map((candidate) => (
                  <li key={candidate.id}>
                    <CandidateCard
                      candidate={candidate}
                      pending={pendingId === candidate.id}
                      disabled={pendingId !== null}
                      onReview={reviewCandidate}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CandidateCard({
  candidate,
  pending,
  disabled,
  onReview,
}: {
  candidate: ReviewCandidate;
  pending: boolean;
  disabled: boolean;
  onReview: (
    candidate: ReviewCandidate,
    action: ReviewAction,
    correctedRecord?: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() =>
    JSON.stringify(candidate.effectiveRecord ?? candidate.exactRecord, null, 2),
  );
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const statusStyles: Record<ReviewStatus, string> = {
    proposed: "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]",
    pending: "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]",
    confirmed: "border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]",
    rejected: "border-border bg-muted text-muted-foreground",
    corrected: "border-[var(--info-border)] bg-[var(--info-background)] text-[var(--info)]",
    superseded: "border-border bg-muted text-muted-foreground",
    stale: "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]",
  };

  const criticalityStyles: Record<Criticality, string> = {
    normal: "text-muted-foreground",
    important: "text-[var(--warning)]",
    critical: "font-medium text-destructive",
  };
  const metadata = recordMetadata(candidate);
  const projectionStatus =
    candidate.projection?.status ?? candidate.projectionStatus;

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCorrectionError(null);
    const cleanDraft = draft.trim();
    if (
      !cleanDraft ||
      cleanDraft ===
        JSON.stringify(
          candidate.effectiveRecord ?? candidate.exactRecord,
          null,
          2,
        )
    ) {
      setDraft(
        JSON.stringify(
          candidate.effectiveRecord ?? candidate.exactRecord,
          null,
          2,
        ),
      );
      setEditing(false);
      return;
    }
    try {
      const correctedRecord = JSON.parse(cleanDraft) as unknown;
      if (
        !correctedRecord ||
        typeof correctedRecord !== "object" ||
        Array.isArray(correctedRecord)
      ) {
        setCorrectionError("The corrected record must be a JSON object.");
        return;
      }
      await onReview(
        candidate,
        "correct",
        correctedRecord as Record<string, unknown>,
      );
      setEditing(false);
    } catch {
      setCorrectionError("Enter valid JSON before saving the correction.");
    }
  }

  const reviewable =
    candidate.reviewStatus === "proposed" ||
    candidate.reviewStatus === "pending";

  return (
    <Card className="gap-0 border border-border bg-card p-4 py-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[candidate.reviewStatus]}`}
          >
            {readableLabel(candidate.reviewStatus)}
          </span>
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {readableLabel(candidate.recordType)}
          </span>
          {projectionStatus ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${projectionBadge(projectionStatus)}`}
              title={candidate.projection?.message}
            >
              Knowledge status: {readableLabel(projectionStatus)}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {candidate.stableRecordId}
        </span>
      </div>

      {editing ? (
        <form onSubmit={submitCorrection} className="mt-4">
          <label
            htmlFor={`correct-${candidate.id}`}
            className="text-sm font-medium text-foreground"
          >
            Correct the structured record
          </label>
          <textarea
            id={`correct-${candidate.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            required
            rows={4}
            maxLength={4000}
            spellCheck={false}
            className="mt-2 min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2.5 font-mono text-sm leading-6 text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          />
          {correctionError ? (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {correctionError}
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button
              type="submit"
              disabled={disabled || !draft.trim()}
            >
              Save correction
            </Button>
            <Button
              type="button"
              onClick={() => {
                setDraft(
                  JSON.stringify(
                    candidate.effectiveRecord ?? candidate.exactRecord,
                    null,
                    2,
                  ),
                );
                setCorrectionError(null);
                setEditing(false);
              }}
              disabled={disabled}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
          {recordSummary(candidate)}
        </p>
      )}

      <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="font-medium text-muted-foreground">Confidence</dt>
          <dd className="mt-1 text-foreground">
            {readableLabel(metadata.confidence)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">Criticality</dt>
          <dd
            className={`mt-1 ${criticalityStyles[metadata.criticality]}`}
          >
            {readableLabel(metadata.criticality)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">Provenance</dt>
          <dd className="mt-1 text-foreground">
            {readableLabel(metadata.provenance.basis)} ·{" "}
            {readableLabel(metadata.provenance.sourceType)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Source: {metadata.provenance.sourceRef}
      </p>
      {candidate.projection?.message ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Storage result: {candidate.projection.message}
        </p>
      ) : null}

      {reviewable && !editing ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            type="button"
            onClick={() => void onReview(candidate, "confirm")}
            disabled={disabled}
            className="bg-[var(--success-solid)] text-[var(--success-solid-foreground)] hover:bg-[color-mix(in_oklch,var(--success-solid),black_10%)]"
          >
            {pending ? "Saving…" : "Confirm"}
          </Button>
          <Button
            type="button"
            onClick={() => void onReview(candidate, "reject")}
            disabled={disabled}
            variant="outline"
          >
            Reject
          </Button>
          <Button
            type="button"
            onClick={() => setEditing(true)}
            disabled={disabled}
            variant="outline"
            className="border-[var(--info-border)] text-[var(--info)] hover:bg-[var(--info-background)]"
          >
            Correct
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
