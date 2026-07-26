"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "blocked":
    case "failed":
      return "border-red-200 bg-red-50 text-red-800";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
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
          <h2 id="review-heading" className="text-xl font-semibold text-slate-950">
            Staged candidates
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {proposedCount} awaiting review · {candidates.length} total
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCandidates()}
          disabled={requestState === "loading" || pendingId !== null}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div aria-live="polite">
        {error ? (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadCandidates()}
              className="mt-2 font-medium underline underline-offset-2"
            >
              Try loading again
            </button>
          </div>
        ) : null}

        {requestState === "loading" ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Loading imported knowledge…
          </p>
        ) : null}

        {requestState === "idle" && candidates.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="font-medium text-slate-900">
              Nothing is waiting for review
            </h3>
            <p className="mt-2 text-sm text-slate-600">
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
              <div className="border-b border-slate-200 pb-2">
                <h3
                  id={`group-${group}`}
                  className="font-semibold text-slate-900"
                >
                  {readableLabel(group)}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
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
    proposed: "border-amber-200 bg-amber-50 text-amber-800",
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-slate-200 bg-slate-100 text-slate-600",
    corrected: "border-indigo-200 bg-indigo-50 text-indigo-800",
    superseded: "border-slate-200 bg-slate-100 text-slate-600",
    stale: "border-orange-200 bg-orange-50 text-orange-800",
  };

  const criticalityStyles: Record<Criticality, string> = {
    normal: "text-slate-600",
    important: "text-amber-700",
    critical: "font-medium text-red-700",
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
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[candidate.reviewStatus]}`}
          >
            {readableLabel(candidate.reviewStatus)}
          </span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
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
        <span className="text-xs text-slate-500">
          {candidate.stableRecordId}
        </span>
      </div>

      {editing ? (
        <form onSubmit={submitCorrection} className="mt-4">
          <label
            htmlFor={`correct-${candidate.id}`}
            className="text-sm font-medium text-slate-800"
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
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {correctionError ? (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {correctionError}
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={disabled || !draft.trim()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Save correction
            </button>
            <button
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
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">
          {recordSummary(candidate)}
        </p>
      )}

      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="font-medium text-slate-500">Confidence</dt>
          <dd className="mt-1 text-slate-800">
            {readableLabel(metadata.confidence)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Criticality</dt>
          <dd
            className={`mt-1 ${criticalityStyles[metadata.criticality]}`}
          >
            {readableLabel(metadata.criticality)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Provenance</dt>
          <dd className="mt-1 text-slate-800">
            {readableLabel(metadata.provenance.basis)} ·{" "}
            {readableLabel(metadata.provenance.sourceType)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Source: {metadata.provenance.sourceRef}
      </p>
      {candidate.projection?.message ? (
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Storage result: {candidate.projection.message}
        </p>
      ) : null}

      {reviewable && !editing ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => void onReview(candidate, "confirm")}
            disabled={disabled}
            className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => void onReview(candidate, "reject")}
            disabled={disabled}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={disabled}
            className="rounded-md border border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            Correct
          </button>
        </div>
      ) : null}
    </article>
  );
}
