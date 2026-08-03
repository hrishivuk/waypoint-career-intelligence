"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface ReviewItem {
  id: string;
  canonical_name: string;
  destination: string;
  source_skills: string[];
  proposed_level: string | null;
  corrected_level: string | null;
  rationale: string;
  evidence_basis: string[];
  blocker_codes: string[];
  review_status: string;
}

interface ReviewBatch {
  id: string;
  status: "staged" | "reviewed" | "projected";
}

const levels = ["learning", "basic", "working", "strong", "expert"];

export function SkillReview() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [batch, setBatch] = useState<ReviewBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/v1/knowledge/skills/review")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message);
        setItems(payload.items);
        setBatch(payload.batch);
      })
      .catch((cause) => setError(cause.message ?? "Could not load review."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div role="status" className="flex min-h-28 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-card text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
        Loading skill review…
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex gap-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-background)] p-4 text-sm text-[var(--danger)]">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </div>
    );
  }
  if (!items.length) {
    return (
      <section className="rounded-xl border border-dashed border-[var(--border-strong)] bg-card px-6 py-10 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-[var(--ai-muted)] text-[var(--ai)]">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-semibold text-foreground">No skill review yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Skill assessments that need confirmation will appear here.
        </p>
      </section>
    );
  }

  const reviewed = items.filter((item) => item.review_status !== "pending");
  const corrected = items.filter((item) => item.review_status === "corrected").length;
  const rejected = items.filter((item) => item.review_status === "rejected").length;
  const allReviewed = reviewed.length === items.length;

  const reviewForm = (
    <form
      action="/api/v1/knowledge/skills/review/batch"
      method="POST"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--info-border)] bg-[var(--info-background)] p-4">
        <p className="text-sm text-[var(--info)]">
          {allReviewed
            ? "Change any dropdown below and save again to update this review."
            : "Review every dropdown, then save the complete batch once."}
        </p>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          {allReviewed ? "Save updated levels" : "Review and save all changes"}
        </button>
      </div>
      {items.map((item) => {
        const selected =
          item.review_status === "rejected"
            ? "reject"
            : item.corrected_level ?? item.proposed_level ?? "";
        return (
          <article key={item.id} className="rounded-xl border border-[var(--border-subtle)] bg-card p-5 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium capitalize text-muted-foreground">
                  {item.destination.replaceAll("_", " ")}
                </p>
                <h2 className="mt-1 font-semibold text-foreground">{item.canonical_name}</h2>
                {item.source_skills.length > 1 ? (
                  <p className="mt-1 text-xs text-[var(--ai)]">
                    Merges {item.source_skills.join(" + ")}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs capitalize text-muted-foreground">
                {item.review_status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.rationale}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
              {item.evidence_basis.map((evidence) => <li key={evidence}>{evidence}</li>)}
            </ul>
            {item.blocker_codes.includes("explicit_assessment_conflict") ? (
              <p className="mt-3 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-background)] p-3 text-sm text-[var(--danger)]">
                This proposed level conflicts with your direct statement and must be corrected.
              </p>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(12rem,18rem)_1fr] sm:items-center">
              <label htmlFor={`level-${item.id}`} className="sr-only">
                Skill level for {item.canonical_name}
              </label>
              <select
                id={`level-${item.id}`}
                name={`level:${item.id}`}
                defaultValue={selected}
                className="min-h-11 rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-sm capitalize text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
              >
                <option value="">Choose level</option>
                {levels.map((level) => <option key={level} value={level}>{level}</option>)}
                <option value="reject">Reject / do not assess</option>
              </select>
              <span className="text-xs leading-5 text-muted-foreground">
                Select Reject if this should not receive a level.
              </span>
            </div>
          </article>
        );
      })}
      <div className="sticky bottom-4 flex justify-end rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)]/95 p-4 shadow-lg backdrop-blur">
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          {allReviewed ? "Save updated levels" : "Review and save all changes"}
        </button>
      </div>
    </form>
  );

  if (allReviewed) {
    const projected = batch?.status === "projected";
    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-[var(--success-border)] bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success-background)] text-[var(--success)]">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
            <div>
          <h2 className="font-semibold text-foreground">
            {projected ? "Skill Model v2 is active" : "Skill review saved"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            All {items.length} records are reviewed: {corrected} corrected, {rejected} rejected,
            and {items.length - corrected - rejected} confirmed.
          </p>
          {projected ? (
            <p className="mt-1 text-sm text-[var(--success)]">
              Your active knowledge and future job analyses can now use these reviewed levels.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Save these decisions to make them available to job analysis.
              </p>
              <form
                action="/api/v1/knowledge/skills/review/project"
                method="POST"
              >
                <button
                  type="submit"
                  className="min-h-11 rounded-lg bg-[var(--success-solid)] px-4 py-2 text-sm font-semibold text-[var(--success-solid-foreground)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
                >
                  Activate reviewed skills
                </button>
              </form>
            </div>
          )}
            </div>
          </div>
        </section>
        <details className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-card">
          <summary className="flex min-h-11 cursor-pointer items-center px-5 py-4 font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35">
            View or change the {items.length} reviewed records
          </summary>
          <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">{reviewForm}</div>
        </details>
      </div>
    );
  }

  return reviewForm;
}
