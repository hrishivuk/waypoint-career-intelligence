"use client";

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

  if (loading) return <p className="text-sm text-slate-500">Loading review…</p>;
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!items.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No skill assessment history is available yet.
      </p>
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm text-indigo-900">
          {allReviewed
            ? "Change any dropdown below and save again to update this review."
            : "Review every dropdown, then save the complete batch once."}
        </p>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
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
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs capitalize text-slate-500">
                  {item.destination.replaceAll("_", " ")}
                </p>
                <h2 className="mt-1 font-semibold text-slate-950">{item.canonical_name}</h2>
                {item.source_skills.length > 1 ? (
                  <p className="mt-1 text-xs text-indigo-600">
                    Merges {item.source_skills.join(" + ")}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize">
                {item.review_status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.rationale}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
              {item.evidence_basis.map((evidence) => <li key={evidence}>{evidence}</li>)}
            </ul>
            {item.blocker_codes.includes("explicit_assessment_conflict") ? (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                This proposed level conflicts with your direct statement and must be corrected.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                name={`level:${item.id}`}
                defaultValue={selected}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm capitalize"
              >
                <option value="">Choose level</option>
                {levels.map((level) => <option key={level} value={level}>{level}</option>)}
                <option value="reject">Reject / do not assess</option>
              </select>
              <span className="text-xs text-slate-500">
                Select Reject if this should not receive a level.
              </span>
            </div>
          </article>
        );
      })}
      <div className="sticky bottom-4 flex justify-end rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white"
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
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold text-emerald-950">
            {projected ? "Skill Model v2 is active" : "Skill review saved"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-emerald-900">
            All {items.length} records are reviewed: {corrected} corrected, {rejected} rejected,
            and {items.length - corrected - rejected} confirmed.
          </p>
          {projected ? (
            <p className="mt-1 text-sm text-emerald-800">
              Your active knowledge and future job analyses can now use these reviewed levels.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-emerald-800">
                Save these decisions to make them available to job analysis.
              </p>
              <form
                action="/api/v1/knowledge/skills/review/project"
                method="POST"
              >
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
                >
                  Activate reviewed skills
                </button>
              </form>
            </div>
          )}
        </section>
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-5 py-4 font-medium text-slate-800">
            View or change the {items.length} reviewed records
          </summary>
          <div className="border-t border-slate-200 p-4">{reviewForm}</div>
        </details>
      </div>
    );
  }

  return reviewForm;
}
