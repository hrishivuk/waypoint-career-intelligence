import { AlertTriangle, ArrowLeft, CheckCircle2, CircleHelp, FileText, ShieldAlert } from "lucide-react";
import Link from "next/link";

import {
  formatJobAnalysisDate,
  formatJobAnalysisScore,
  getJobDisplayIdentity,
  getRecommendationPresentation,
  uniqueTextItems,
  type SavedJobAnalysisDetail,
} from "@/application/job-analysis";
import { RecommendationBadge } from "@/components/jobs/saved-jobs-list";

export function SavedJobDetail({ detail }: { detail: SavedJobAnalysisDetail }) {
  const { analysis } = detail;
  const identity = getJobDisplayIdentity(analysis);
  const recommendation = getRecommendationPresentation(analysis.recommendation);
  const scores = [
    ["Requirements", analysis.requirementsScore], ["Career direction", analysis.directionScore],
    ["Preferences", analysis.preferenceScore], ["Eligibility", analysis.eligibilityScore],
    ["Evidence confidence", analysis.evidenceConfidence], ["Knowledge coverage", analysis.knowledgeCoverage],
  ] as const;

  return (
    <article>
      <Link href="/jobs" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:text-[var(--primary-hover)]"><ArrowLeft className="size-4" aria-hidden="true" />Back to jobs</Link>
      <header className="mt-4 border-b border-[var(--border-subtle)] pb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl"><p className="text-sm text-muted-foreground">{identity.company} · Analysed {formatJobAnalysisDate(detail.completedAt)}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{identity.title}</h1><p className="mt-4 text-base leading-7 text-muted-foreground">{analysis.summary || "No summary was stored for this analysis."}</p></div>
          <div className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4"><RecommendationBadge tone={recommendation.tone}>{recommendation.label}</RecommendationBadge><span className="font-mono text-2xl font-semibold tabular-nums text-foreground">{formatJobAnalysisScore(analysis.overallScore)}</span></div>
        </div>
      </header>

      {detail.resultCompatibility !== "current" ? <div className="mt-6 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-background)] p-4 text-sm text-[var(--warning)]"><strong>Historical result.</strong> Some newer analysis details may not be available, but the saved decision and score remain unchanged.</div> : null}

      <section aria-labelledby="decision-title" className="py-8"><h2 id="decision-title" className="text-xl font-semibold text-foreground">Decision</h2><p className="mt-2 text-sm text-muted-foreground">{recommendation.description}</p><div className="mt-5 grid gap-4 lg:grid-cols-2"><EvidenceList title="Why it could fit" items={uniqueTextItems(analysis.strengths)} icon={CheckCircle2} tone="success" empty="No specific strengths were stored." /><EvidenceList title="What needs attention" items={uniqueTextItems([...analysis.blockers, ...analysis.gaps, ...analysis.uncertainties])} icon={AlertTriangle} tone="warning" empty="No blockers or gaps were stored." /></div></section>

      <section aria-labelledby="scores-title" className="border-t border-[var(--border-subtle)] py-8"><h2 id="scores-title" className="text-xl font-semibold text-foreground">Score breakdown</h2><div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-3">{scores.map(([label, score]) => <div key={label} className="bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground">{formatJobAnalysisScore(score)}</p></div>)}</div></section>

      <section aria-labelledby="requirements-title" className="border-t border-[var(--border-subtle)] py-8"><div className="flex items-end justify-between gap-4"><div><h2 id="requirements-title" className="text-xl font-semibold text-foreground">Requirements and evidence</h2><p className="mt-1 text-sm text-muted-foreground">Read-only historical assessment.</p></div><span className="text-sm text-muted-foreground">{analysis.requirements.length} requirements</span></div>{analysis.requirements.length ? <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-card"><ul className="divide-y divide-[var(--border-subtle)]">{analysis.requirements.map((requirement, index) => <li key={`${requirement.text}-${index}`} className="p-5"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{requirement.text}</span><span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs capitalize text-muted-foreground">{requirement.outcome?.replaceAll("_", " ") ?? requirement.match}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{requirement.explanation}</p>{requirement.evidence.length ? <ul className="mt-3 space-y-1 text-sm text-foreground">{uniqueTextItems(requirement.evidence).map((evidence) => <li key={evidence}>• {evidence}</li>)}</ul> : null}</li>)}</ul></div> : <p className="mt-5 rounded-xl bg-[var(--surface-sunken)] p-5 text-sm text-muted-foreground">Detailed requirements were not stored for this analysis.</p>}</section>

      {analysis.bestCv ? <section aria-labelledby="cv-title" className="border-t border-[var(--border-subtle)] py-8"><div className="rounded-xl border border-[var(--border-subtle)] bg-card p-5 sm:flex sm:items-start sm:justify-between sm:gap-6"><div className="flex items-start gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-primary"><FileText className="size-5" aria-hidden="true" /></span><div><h2 id="cv-title" className="font-semibold text-foreground">Best saved CV match: {analysis.bestCv.name}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{analysis.bestCv.reason}</p></div></div><span className="mt-4 block font-mono text-lg font-semibold text-foreground sm:mt-0">{formatJobAnalysisScore(analysis.bestCv.score)}</span></div></section> : null}

      <details className="border-t border-[var(--border-subtle)] py-6"><summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-primary"><CircleHelp className="size-4" aria-hidden="true" />Analysis provenance</summary><dl className="mt-4 grid gap-3 rounded-xl bg-[var(--surface-sunken)] p-5 text-sm sm:grid-cols-2"><Meta label="Model" value={detail.modelId} /><Meta label="Prompt" value={detail.promptVersion} /><Meta label="Schema" value={detail.schemaVersion} /><Meta label="Scoring policy" value={detail.scoringPolicyVersion} /></dl><details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">View original job description</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--surface-sunken)] p-4 text-xs leading-6 text-foreground">{detail.jobDescription}</pre></details></details>
    </article>
  );
}

function EvidenceList({ title, items, icon: Icon, tone, empty }: { title: string; items: string[]; icon: typeof ShieldAlert; tone: "success" | "warning"; empty: string }) { const colors = tone === "success" ? "text-[var(--success)] bg-[var(--success-background)]" : "text-[var(--warning)] bg-[var(--warning-background)]"; return <div className="rounded-xl border border-[var(--border-subtle)] bg-card p-5"><h3 className="flex items-center gap-2 font-semibold text-foreground"><span className={`flex size-8 items-center justify-center rounded-lg ${colors}`}><Icon className="size-4" aria-hidden="true" /></span>{title}</h3>{items.length ? <ul className="mt-4 space-y-3">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground"><span aria-hidden="true">•</span><span>{item}</span></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">{empty}</p>}</div>; }
function Meta({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{value}</dd></div>; }
