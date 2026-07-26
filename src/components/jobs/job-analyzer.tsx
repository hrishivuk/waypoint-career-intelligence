"use client";

import { useState } from "react";

import type { JobAnalysisResult } from "@/application/job-analysis";

export function JobAnalyzer() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<JobAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<number | null>(
    null,
  );
  const [knowledgeKind, setKnowledgeKind] = useState<
    "skill" | "competency" | "evidence" | "preference"
  >("skill");
  const [knowledgeNames, setKnowledgeNames] = useState("");
  const [knowledgeDetails, setKnowledgeDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function analyze(force = false, reparse = false) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/v1/jobs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, force, reparse }),
      });
      const payload = (await response.json()) as JobAnalysisResult & {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Analysis failed.");
      }
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function startCorrection(index: number) {
    const requirement = result?.requirements[index];
    if (!requirement) return;
    setEditingRequirement(index);
    setKnowledgeKind(
      requirement.kind === "skill"
        ? "skill"
        : requirement.kind === "other"
          ? "competency"
        : ["location", "eligibility"].includes(requirement.kind)
          ? "preference"
          : "evidence",
    );
    setKnowledgeNames(suggestKnowledgeNames(requirement.text));
    setKnowledgeDetails("");
  }

  async function saveCorrection() {
    if (editingRequirement === null || !result) return;
    const requirement = result.requirements[editingRequirement];
    const names = knowledgeNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: knowledgeKind,
          names,
          details: knowledgeDetails,
          sourceRequirement: requirement.text,
        }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not save knowledge.");
      }
      setEditingRequirement(null);
      await analyze(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save knowledge.",
      );
      setLoading(false);
    }
  }

  async function changeCriticality(
    index: number,
    criticality: NonNullable<
      JobAnalysisResult["requirements"][number]["criticality"]
    >,
  ) {
    if (!result) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/jobs/analyses/${result.analysisId}/requirements/${index}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ criticality }),
        },
      );
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Could not update requirement.",
        );
      }
      await analyze(true, false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update requirement.",
      );
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setResult(null)}
            className="text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            ← Analyse another job
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={loading}
              onClick={() => void analyze(true, false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              {loading ? "Re-running…" : "Re-score latest knowledge"}
            </button>
            <button
              disabled={loading}
              onClick={() => void analyze(true, true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Re-parse description
            </button>
          </div>
        </div>
        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {result.semanticStatus &&
        result.semanticStatus !== "completed" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {result.semanticStatus === "partial_fallback"
              ? "Some semantic comparisons were unavailable. Waypoint used verified deterministic evidence for those requirements."
              : "The AI comparison provider was unavailable. This result uses deterministic evidence only and is marked as lower confidence."}
          </p>
        ) : null}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-indigo-600">
                Step 1 · Fit against your confirmed knowledge
              </p>
              <p className="text-sm text-slate-500">
                {result.company ?? "Company not identified"}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {result.title ?? "Untitled role"}
              </h2>
            </div>
            <div className="text-right">
              <span className={recommendationClass(result.recommendation)}>
                {recommendationLabel(result.recommendation)}
              </span>
              <p className="mt-2 text-3xl font-semibold text-slate-950">
                {result.overallScore}
                <span className="text-base font-normal text-slate-400">/100</span>
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-3xl leading-7 text-slate-700">
            {result.summary}
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-semibold text-emerald-950">
              Why this role could fit
            </h2>
            {result.strengths.length ? (
              <ul className="mt-3 space-y-3">
                {result.strengths.slice(0, 5).map((strength) => (
                  <li
                    key={strength}
                    className="flex gap-3 text-sm leading-6 text-emerald-950"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600"
                    />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-emerald-900">
                No clear strengths were confirmed for this role yet.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-semibold text-amber-950">
              What to investigate
            </h2>
            {result.gaps.length ? (
              <div className="mt-3 space-y-3">
                {result.gaps.slice(0, 5).map((gap) => {
                  const required = result.blockers.includes(gap);
                  return (
                    <div
                      key={gap}
                      className="flex items-start justify-between gap-3 text-sm leading-6 text-amber-950"
                    >
                      <span>{gap}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          required
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {required ? "Required" : "Missing evidence"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-amber-900">
                No unresolved concerns were identified.
              </p>
            )}
          </div>
        </section>

        {result.bestCv ? (
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              Step 2 · Best starting CV
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              {result.bestCv.name}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {result.bestCv.reason}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-white px-3 py-1.5 text-indigo-700">
                CV coverage {result.bestCv.score}/100
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-slate-700">
                {result.bestCv.representedCount ?? 0} represented
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-slate-700">
                {result.bestCv.relevantCount ?? 0} relevant
              </span>
            </div>
            {result.bestCv.representedRequirements?.length ? (
              <details className="mt-3 text-sm text-slate-700">
                <summary className="cursor-pointer font-medium text-indigo-700">
                  Evidence already visible in this CV
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.bestCv.representedRequirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {result.bestCv.missingImportantKnowledge?.length ? (
              <details className="mt-3 text-sm text-slate-700">
                <summary className="cursor-pointer font-medium text-indigo-700">
                  Important evidence not represented in this CV
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.bestCv.missingImportantKnowledge.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {result.bestCv.suggestedChanges?.length ? (
              <details className="mt-3 text-sm text-slate-700">
                <summary className="cursor-pointer font-medium text-indigo-700">
                  Recommended truthful tailoring
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.bestCv.suggestedChanges.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Step 2 · CV presentation
            </p>
            <h2 className="mt-2 font-semibold text-slate-950">
              No ready CV could be compared
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Upload and successfully parse a CV in the CV library, then re-run
              this analysis to receive CV selection and coverage guidance.
            </p>
          </section>
        )}

        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <h2 className="font-semibold text-slate-950">
                Full analysis breakdown
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Scores, evidence and all {result.requirements.length} extracted
                requirements.
              </p>
            </div>
            <span className="text-sm font-medium text-indigo-700">
              <span className="group-open:hidden">View details</span>
              <span className="hidden group-open:inline">Hide details</span>
            </span>
          </summary>
          <div className="border-t border-slate-100 p-5 sm:p-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Score label="Requirements" value={result.requirementsScore} />
              <Score
                label="Knowledge coverage"
                value={result.knowledgeCoverage ?? 0}
              />
              <Score
                label="Evidence confidence"
                value={result.evidenceConfidence ?? 0}
              />
              <Score label="Career direction" value={result.directionScore} />
              <Score label="Preferences" value={result.preferenceScore} />
            </section>
            <h3 className="mt-8 text-lg font-semibold text-slate-950">
              Requirement by requirement
            </h3>
            <div className="mt-4 space-y-3">
            {result.requirements.map((requirement, index) => (
              <details
                key={`${requirement.text}-${index}`}
                className="rounded-xl border border-slate-200 bg-white"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      {requirement.text}
                    </p>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {(requirement.criticality ?? (requirement.required
                        ? "mandatory_core"
                        : "preferred"
                      )).replaceAll("_", " ")}{" "}
                      · {requirement.kind}
                    </p>
                  </div>
                  <span className={matchClass(requirement.match)}>
                    {matchLabel(requirement.match)}
                  </span>
                </summary>
                <div className="border-t border-slate-100 p-4 text-sm leading-6 text-slate-600">
                  <p>{requirement.explanation}</p>
                  <label className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">
                      Importance:
                    </span>
                    <select
                      disabled={loading}
                      value={
                        requirement.criticality ??
                        (requirement.required
                          ? "mandatory_core"
                          : "preferred")
                      }
                      onChange={(event) =>
                        void changeCriticality(
                          index,
                          event.target.value as NonNullable<
                            typeof requirement.criticality
                          >,
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                    >
                      <option value="eligibility">Eligibility</option>
                      <option value="mandatory_core">Mandatory core</option>
                      <option value="important">Important</option>
                      <option value="preferred">Preferred</option>
                      <option value="bonus">Bonus</option>
                      <option value="unclear">Unclear</option>
                    </select>
                  </label>
                  {requirement.evidence.length ? (
                    <p className="mt-2">
                      <span className="font-medium text-slate-800">
                        Evidence:
                      </span>{" "}
                      {requirement.evidence.join(" · ")}
                    </p>
                  ) : null}
                  {requirement.match !== "matched" ? (
                    <button
                      onClick={() => startCorrection(index)}
                      className="mt-3 font-medium text-indigo-700 hover:underline"
                    >
                      Add or correct my evidence
                    </button>
                  ) : null}
                  {editingRequirement === index ? (
                    <div className="mt-4 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                      <p className="font-medium text-slate-900">
                        Add a confirmed correction
                      </p>
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600">
                          Store as
                        </span>
                        <select
                          value={knowledgeKind}
                          onChange={(event) =>
                            setKnowledgeKind(
                              event.target.value as typeof knowledgeKind,
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                        >
                          <option value="skill">Skill</option>
                          <option value="competency">
                            Professional competency
                          </option>
                          <option value="evidence">Experience evidence</option>
                          <option value="preference">
                            Preference or constraint
                          </option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600">
                          {knowledgeKind === "skill"
                            ? "Skills (comma separated)"
                            : "Name"}
                        </span>
                        <input
                          value={knowledgeNames}
                          onChange={(event) =>
                            setKnowledgeNames(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                        />
                      </label>
                      {knowledgeKind !== "skill" ? (
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">
                            Factual details
                          </span>
                          <textarea
                            value={knowledgeDetails}
                            onChange={(event) =>
                              setKnowledgeDetails(event.target.value)
                            }
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                          />
                        </label>
                      ) : null}
                      <div className="flex gap-2">
                        <button
                          disabled={loading || !knowledgeNames.trim()}
                          onClick={() => void saveCorrection()}
                          className="rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white disabled:opacity-40"
                        >
                          Save and re-run
                        </button>
                        <button
                          onClick={() => setEditingRequirement(null)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            ))}
            </div>
          </div>
        </details>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <label
        htmlFor="job-description"
        className="text-sm font-medium text-slate-900"
      >
        Job description
      </label>
      <textarea
        id="job-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={18}
        placeholder="Paste the complete job description here…"
        className="mt-3 w-full resize-y rounded-xl border border-slate-300 p-4 text-sm leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          AI structures the description. Waypoint checks the result against
          confirmed evidence before scoring it.
        </p>
        <button
          disabled={loading || description.trim().length < 80}
          onClick={() => void analyze(false)}
          className="shrink-0 rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Analysing…" : "Analyse job"}
        </button>
      </div>
    </section>
  );
}

function suggestKnowledgeNames(requirement: string) {
  const normalised = requirement.toLowerCase();
  if (
    normalised.includes("growth mindset") ||
    normalised.includes("ambiguity")
  ) {
    return "Growth Mindset, Ambiguity Navigation";
  }
  if (normalised.includes("agile") && normalised.includes("cross-functional")) {
    return "Agile (Scrum), Cross-functional Collaboration";
  }
  if (normalised.includes("agile")) return "Agile (Scrum)";
  if (normalised.includes("cross-functional")) {
    return "Cross-functional Collaboration";
  }
  return "";
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function recommendationClass(value: JobAnalysisResult["recommendation"]) {
  const color =
    value === "apply"
      ? "bg-emerald-100 text-emerald-800"
      : value === "investigate"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return `inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${color}`;
}

function recommendationLabel(value: JobAnalysisResult["recommendation"]) {
  return {
    apply: "Worth applying",
    investigate: "Investigate first",
    skip: "Probably skip",
  }[value];
}

function matchLabel(match: JobAnalysisResult["requirements"][number]["match"]) {
  return {
    matched: "Supported",
    partial: "Partially supported",
    gap: "Missing evidence",
    uncertain: "Needs clarification",
  }[match];
}

function matchClass(match: string) {
  const color =
    match === "matched"
      ? "bg-emerald-50 text-emerald-700"
      : match === "partial" || match === "uncertain"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";
  return `shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${color}`;
}
