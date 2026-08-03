import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import Link from "next/link";

import {
  formatJobAnalysisDate,
  formatJobAnalysisScore,
  getJobDisplayIdentity,
  getRecommendationPresentation,
  type SavedJobAnalysisSummary,
} from "@/application/job-analysis";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function SavedJobsList({ analyses }: { analyses: SavedJobAnalysisSummary[] }) {
  if (!analyses.length) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-card px-5 py-12 text-center sm:px-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-primary">
          <BriefcaseBusiness className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-foreground">No jobs analysed yet</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Paste a job description and Waypoint will compare it with your confirmed Career Profile and CV library.</p>
        <Link href="/jobs/new" className={cn(buttonVariants(), "mt-6")}>Analyse your first job</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="saved-jobs-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><h2 id="saved-jobs-title" className="text-lg font-semibold text-foreground">Recent decisions</h2><p className="mt-1 text-sm text-muted-foreground">Newest completed analysis first.</p></div>
        <span className="text-sm text-muted-foreground">{analyses.length} saved</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-card">
        <ul className="divide-y divide-[var(--border-subtle)]">
          {analyses.map((analysis) => {
            const identity = getJobDisplayIdentity(analysis);
            const recommendation = getRecommendationPresentation(analysis.recommendation);
            return (
              <li key={analysis.analysisId}>
                <Link href={`/jobs/${analysis.analysisId}`} className="group grid min-h-28 gap-4 p-5 transition-colors hover:bg-[var(--surface-raised)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary">{identity.title}</h3>
                      <RecommendationBadge tone={recommendation.tone}>{recommendation.label}</RecommendationBadge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{identity.company} · {formatJobAnalysisDate(analysis.completedAt)}</p>
                    {analysis.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{analysis.summary}</p> : null}
                  </div>
                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <span className="font-mono text-lg font-semibold tabular-nums text-foreground">{formatJobAnalysisScore(analysis.overallScore)}</span>
                    <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function RecommendationBadge({ tone, children }: { tone: "success" | "warning" | "danger"; children: React.ReactNode }) {
  const tones = {
    success: "border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]",
    warning: "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]",
    danger: "border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]",
  };
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}
