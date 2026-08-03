"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  RefreshCw,
  ScanText,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import type { JobAnalysisResult } from "@/application/job-analysis";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      <div className="space-y-8" aria-busy={loading}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setResult(null)}
            className="w-full justify-start sm:w-auto"
          >
            <ArrowLeft aria-hidden="true" data-icon="inline-start" />
            Analyse another job
          </Button>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void analyze(true, false)}
            >
              <RefreshCw aria-hidden="true" data-icon="inline-start" />
              {loading ? "Re-running…" : "Re-score latest knowledge"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void analyze(true, true)}
            >
              <ScanText aria-hidden="true" data-icon="inline-start" />
              Re-parse description
            </Button>
          </div>
        </div>
        {error ? (
          <Alert
            variant="destructive"
            className="border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]"
          >
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Analysis could not be updated</AlertTitle>
            <AlertDescription className="text-[var(--danger)]">{error}</AlertDescription>
          </Alert>
        ) : null}
        {result.semanticStatus &&
        result.semanticStatus !== "completed" ? (
          <Alert className="border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>Lower-confidence comparison</AlertTitle>
            <AlertDescription className="text-[var(--warning)]">
              {result.semanticStatus === "partial_fallback"
                ? "Some semantic comparisons were unavailable. Waypoint used verified deterministic evidence for those requirements."
                : "The AI comparison provider was unavailable. This result uses deterministic evidence only and is marked as lower confidence."}
            </AlertDescription>
          </Alert>
        ) : null}
        <section
          aria-labelledby="analysis-result-heading"
          className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
        >
          <div className="h-1 bg-primary" />
          <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-primary">
                Step 1 · Fit against your confirmed knowledge
              </p>
              <p className="text-sm text-muted-foreground">
                {result.company ?? "Company not identified"}
              </p>
              <h2 id="analysis-result-heading" className="mt-1 text-2xl font-semibold tracking-[var(--tracking-tight)] text-foreground">
                {result.title ?? "Untitled role"}
              </h2>
            </div>
            <div className="text-right">
              <span className={recommendationClass(result.recommendation)}>
                {recommendationLabel(result.recommendation)}
              </span>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
                {result.overallScore}
                <span className="text-base font-normal text-muted-foreground">/100</span>
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-[var(--reading-max)] leading-7 text-muted-foreground">
            {result.summary}
          </p>
          </div>
        </section>

        <section aria-label="Decision summary" className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-2 lg:divide-x lg:divide-[var(--border-subtle)]">
          <div className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold text-[var(--success)]">
              <CheckCircle2 aria-hidden="true" className="size-5" />
              Why this role could fit
            </h2>
            {result.strengths.length ? (
              <ul className="mt-3 space-y-3">
                {result.strengths.slice(0, 5).map((strength) => (
                  <li
                    key={strength}
                    className="flex gap-3 text-sm leading-6 text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--success-solid)]"
                    />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                No clear strengths were confirmed for this role yet.
              </p>
            )}
          </div>

          <div className="border-t border-[var(--border-subtle)] p-5 sm:p-6 lg:border-t-0">
            <h2 className="flex items-center gap-2 font-semibold text-[var(--warning)]">
              <ShieldAlert aria-hidden="true" className="size-5" />
              What to investigate
            </h2>
            {result.gaps.length ? (
              <div className="mt-3 space-y-3">
                {result.gaps.slice(0, 5).map((gap) => {
                  const required = result.blockers.includes(gap);
                  return (
                    <div
                      key={gap}
                      className="flex items-start justify-between gap-3 text-sm leading-6 text-foreground"
                    >
                      <span>{gap}</span>
                      <Badge
                        variant="outline"
                        className={required
                          ? "border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]"
                          : "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]"}
                      >
                        {required ? "Required" : "Missing evidence"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                No unresolved concerns were identified.
              </p>
            )}
          </div>
        </section>

        {result.bestCv ? (
          <section className="rounded-xl border border-[var(--info-border)] bg-[var(--info-background)] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-[var(--info)]">
              Step 2 · Best starting CV
            </p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">
              {result.bestCv.name}
            </h2>
            <p className="mt-1 text-sm leading-6 text-foreground">
              {result.bestCv.reason}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full border border-[var(--info-border)] bg-[var(--surface-overlay)] px-3 py-1.5 text-[var(--info)]">
                CV coverage {result.bestCv.score}/100
              </span>
              <span className="rounded-full border border-[var(--info-border)] bg-[var(--surface-overlay)] px-3 py-1.5 text-foreground">
                {result.bestCv.representedCount ?? 0} represented
              </span>
              <span className="rounded-full border border-[var(--info-border)] bg-[var(--surface-overlay)] px-3 py-1.5 text-foreground">
                {result.bestCv.relevantCount ?? 0} relevant
              </span>
            </div>
            {result.bestCv.representedRequirements?.length ? (
              <details className="group mt-3 text-sm text-foreground">
                <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 font-medium text-[var(--info)] marker:content-none">
                  Evidence already visible in this CV
                  <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.bestCv.representedRequirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {result.bestCv.missingImportantKnowledge?.length ? (
              <details className="group mt-3 text-sm text-foreground">
                <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 font-medium text-[var(--info)] marker:content-none">
                  Important evidence not represented in this CV
                  <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.bestCv.missingImportantKnowledge.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {result.bestCv.suggestedChanges?.length ? (
              <details className="group mt-3 text-sm text-foreground">
                <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 font-medium text-[var(--info)] marker:content-none">
                  Recommended truthful tailoring
                  <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
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
          <section className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-muted-foreground">
              Step 2 · CV presentation
            </p>
            <h2 className="mt-2 font-semibold text-foreground">
              No ready CV could be compared
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Upload and successfully parse a CV in the CV library, then re-run
              this analysis to receive CV selection and coverage guidance.
            </p>
          </section>
        )}

        <details className="group overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-5 marker:content-none sm:p-6">
            <div>
              <h2 className="font-semibold text-foreground">
                Full analysis breakdown
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Scores, evidence and all {result.requirements.length} extracted
                requirements.
              </p>
            </div>
            <span className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-primary">
              <span className="group-open:hidden">View details</span>
              <span className="hidden group-open:inline">Hide details</span>
              <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 sm:p-6">
            <section aria-label="Detailed scores" className="grid overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-card sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-[var(--border-subtle)]">
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
            <h3 className="mt-8 text-lg font-semibold text-foreground">
              Requirement by requirement
            </h3>
            <div className="mt-4 space-y-3">
            {result.requirements.map((requirement, index) => (
              <details
                key={`${requirement.text}-${index}`}
                className="group/requirement overflow-hidden rounded-lg border border-border bg-card"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-start justify-between gap-4 p-4 marker:content-none">
                  <div>
                    <p className="font-medium text-foreground">
                      {requirement.text}
                    </p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {(requirement.criticality ?? (requirement.required
                        ? "mandatory_core"
                        : "preferred"
                      )).replaceAll("_", " ")}{" "}
                      · {requirement.kind}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={matchClass(requirement.match)}>
                      {matchLabel(requirement.match)}
                    </span>
                    <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open/requirement:rotate-180" />
                  </span>
                </summary>
                <div className="border-t border-[var(--border-subtle)] p-4 text-sm leading-6 text-muted-foreground">
                  <p>{requirement.explanation}</p>
                  <label className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="font-medium text-foreground">
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
                      className="min-h-11 rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
                      <span className="font-medium text-foreground">
                        Evidence:
                      </span>{" "}
                      {requirement.evidence.join(" · ")}
                    </p>
                  ) : null}
                  {requirement.match !== "matched" ? (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => startCorrection(index)}
                      className="mt-2 px-0"
                    >
                      Add or correct my evidence
                    </Button>
                  ) : null}
                  {editingRequirement === index ? (
                    <div className="mt-4 space-y-4 rounded-lg border border-[var(--ai-muted-foreground)] bg-[var(--ai-muted)] p-4">
                      <p className="font-semibold text-foreground">
                        Add a confirmed correction
                      </p>
                      <label className="block">
                        <span className="text-sm font-medium text-foreground">
                          Store as
                        </span>
                        <select
                          value={knowledgeKind}
                          onChange={(event) =>
                            setKnowledgeKind(
                              event.target.value as typeof knowledgeKind,
                            )
                          }
                          className="mt-2 min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-foreground outline-none"
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
                        <span className="text-sm font-medium text-foreground">
                          {knowledgeKind === "skill"
                            ? "Skills (comma separated)"
                            : "Name"}
                        </span>
                        <input
                          value={knowledgeNames}
                          onChange={(event) =>
                            setKnowledgeNames(event.target.value)
                          }
                          className="mt-2 min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-foreground outline-none"
                        />
                      </label>
                      {knowledgeKind !== "skill" ? (
                        <label className="block">
                          <span className="text-sm font-medium text-foreground">
                            Factual details
                          </span>
                          <textarea
                            value={knowledgeDetails}
                            onChange={(event) =>
                              setKnowledgeDetails(event.target.value)
                            }
                            rows={3}
                            className="mt-2 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-foreground outline-none"
                          />
                        </label>
                      ) : null}
                      <div className="grid gap-2 sm:flex">
                        <Button
                          type="button"
                          disabled={loading || !knowledgeNames.trim()}
                          onClick={() => void saveCorrection()}
                        >
                          Save and re-run
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingRequirement(null)}
                        >
                          Cancel
                        </Button>
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
    <section
      aria-labelledby="job-input-heading"
      aria-busy={loading}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
    >
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--ai-muted)] text-[var(--ai-muted-foreground)]">
            <FileSearch aria-hidden="true" className="size-5" />
          </span>
          <h2 id="job-input-heading" className="mt-4 text-xl font-semibold tracking-[var(--tracking-tight)] text-foreground">
            Add the role you are considering
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Paste the full advert so Waypoint can identify requirements, compare
            them with confirmed evidence, and assess your strongest CV.
          </p>
        </div>
        <aside className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
          <p className="text-sm font-semibold text-foreground">For a stronger result</p>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground">
            <li>Include responsibilities and requirements</li>
            <li>Keep company and location details</li>
            <li>Remove only unrelated page navigation</li>
          </ul>
        </aside>
      </div>
      <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 sm:p-7">
        <label htmlFor="job-description" className="text-sm font-semibold text-foreground">
          Job description
        </label>
        <p id="job-description-guidance" className="mt-1 text-sm text-muted-foreground">
          Enter at least 80 characters. The complete advert usually produces the most reliable comparison.
        </p>
        <textarea
          id="job-description"
          aria-describedby="job-description-guidance job-description-count"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={16}
          placeholder="Paste the complete job description here…"
          className="mt-3 min-h-56 w-full resize-y rounded-lg border border-input bg-[var(--surface-overlay)] px-4 py-3 text-base leading-7 text-foreground shadow-xs outline-none placeholder:text-[var(--text-tertiary)]"
        />
      {error ? (
        <Alert
          variant="destructive"
          className="mt-4 border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]"
        >
          <AlertCircle aria-hidden="true" />
          <AlertTitle>We couldn’t analyse this role</AlertTitle>
          <AlertDescription className="text-[var(--danger)]">{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p id="job-description-count" className="text-xs font-medium tabular-nums text-muted-foreground">
            {description.length.toLocaleString()} characters
          </p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            AI structures the description. Waypoint verifies the comparison
            against your confirmed evidence before scoring it.
          </p>
        </div>
        <Button
          type="button"
          disabled={loading || description.trim().length < 80}
          onClick={() => void analyze(false)}
          className="w-full shrink-0 sm:w-auto"
        >
          <Sparkles aria-hidden="true" data-icon="inline-start" />
          {loading ? "Analysing…" : "Analyse job"}
        </Button>
      </div>
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
    <div className="border-b border-[var(--border-subtle)] p-4 last:border-b-0 sm:[&:nth-child(4)]:border-b-0 sm:[&:nth-child(5)]:border-b-0 lg:border-b-0">
      <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function recommendationClass(value: JobAnalysisResult["recommendation"]) {
  const color =
    value === "apply"
      ? "border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]"
      : value === "investigate"
        ? "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]"
        : "border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]";
  return `inline-flex rounded-full border px-3 py-1 text-sm font-semibold capitalize ${color}`;
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
      ? "border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]"
      : match === "partial" || match === "uncertain"
        ? "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]"
        : "border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]";
  return `shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${color}`;
}
