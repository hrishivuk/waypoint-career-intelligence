"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Candidate {
  id: string;
  record_type: string;
  title: string;
  statement: string;
  source_excerpt: string;
  structured_data: {
    proficiency?: string | null;
    proficiencyBasis?: string | null;
  };
  decision: "pending" | "confirmed" | "rejected";
  reconciliation:
    | "new"
    | "update_existing"
    | "already_known"
    | "possible_conflict";
}

interface ImportSummary {
  id: string;
  status: "staged" | "activated" | "superseded";
}

interface ImportResponse {
  currentImport: ImportSummary | null;
  candidates: Candidate[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }
  return payload;
}

export function NarrativeImporter() {
  const [narrative, setNarrative] = useState("");
  const [currentImport, setCurrentImport] =
    useState<ImportSummary | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activated, setActivated] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void request<ImportResponse>("/api/v1/profile/imports")
      .then((result) => {
        if (!active) return;
        setCurrentImport(result.currentImport);
        setCandidates(result.candidates);
        setSelected(
          new Set(
            result.candidates
              .filter(
                (item) =>
                  item.decision !== "rejected" &&
                  item.reconciliation === "new",
              )
              .map((item) => item.id),
          ),
        );
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Your existing profile review could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(
    () =>
      [...new Set(candidates.map((item) => item.record_type))].map((type) => ({
        type,
        records: candidates.filter((item) => item.record_type === type),
      })),
    [candidates],
  );

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setActivated(null);
    try {
      const result = await request<ImportResponse>("/api/v1/profile/imports", {
        method: "POST",
        body: JSON.stringify({ narrative }),
      });
      setCurrentImport(result.currentImport);
      setCandidates(result.candidates);
      setSelected(
        new Set(
          result.candidates
            .filter((item) => item.reconciliation === "new")
            .map((item) => item.id),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The narrative could not be structured.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function activateProfile() {
    if (!currentImport) return;
    setBusy(true);
    setError(null);
    try {
      const result = await request<{ activated: number }>(
        `/api/v1/profile/imports/${currentImport.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            decisions: candidates.map((candidate) => ({
              id: candidate.id,
              decision: selected.has(candidate.id)
                ? "confirmed"
                : "rejected",
            })),
            activate: true,
          }),
        },
      );
      setActivated(result.activated);
      setCurrentImport({ ...currentImport, status: "activated" });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The Master Profile could not be activated.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="profile-input-heading"
        className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
      >
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-muted)] text-[var(--primary-muted-foreground)]">
                <FileText aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-primary">
                  Career evidence
                </p>
                <h2
                  id="profile-input-heading"
                  className="mt-1 text-xl font-semibold tracking-[var(--tracking-tight)] text-foreground"
                >
                  Add to your Master Profile
                </h2>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              Write about one topic or paste a longer career narrative. Waypoint
              turns it into reviewable facts and compares them with your current
              profile. Nothing becomes active until you approve it.
            </p>
          </div>
          <aside className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
            <p className="text-sm font-semibold text-foreground">Useful details to include</p>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground">
              <li>Role, project, or situation</li>
              <li>What you personally did</li>
              <li>Tools, skills, and collaborators</li>
              <li>Outcome or measurable result</li>
            </ul>
          </aside>
        </div>

        <form onSubmit={generate} className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 sm:p-7">
          <label htmlFor="career-narrative" className="text-sm font-semibold text-foreground">
            Career narrative
          </label>
          <p id="career-narrative-guidance" className="mt-1 text-sm text-muted-foreground">
            Enter at least 100 characters. You can add another topic later.
          </p>
          <textarea
            id="career-narrative"
            aria-describedby="career-narrative-guidance career-narrative-count"
            value={narrative}
            onChange={(event) => setNarrative(event.target.value)}
            minLength={100}
            maxLength={12000}
            required
            rows={14}
            placeholder="Example: I led the redesign of our customer onboarding flow. I interviewed support teams, mapped the main drop-off points, prototyped a simpler journey, and worked with engineering to ship it. Completion increased by 18% over the following quarter."
            className="mt-3 block min-h-44 w-full resize-y rounded-lg border border-input bg-[var(--surface-overlay)] px-4 py-3 text-base leading-7 text-foreground shadow-xs outline-none placeholder:text-[var(--text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span id="career-narrative-count" className="text-xs font-medium tabular-nums text-muted-foreground">
              {narrative.length.toLocaleString()} of 12,000 characters
            </span>
            <Button
              type="submit"
              disabled={busy || narrative.trim().length < 100}
              className="w-full sm:w-auto"
            >
              <Sparkles aria-hidden="true" data-icon="inline-start" />
              {busy ? "Structuring profile…" : "Create review"}
            </Button>
          </div>
        </form>
      </section>

      {error ? (
        <Alert
          variant="destructive"
          className="border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]"
        >
          <AlertCircle aria-hidden="true" />
          <AlertTitle>We couldn’t complete that action</AlertTitle>
          <AlertDescription className="text-[var(--danger)]">{error}</AlertDescription>
        </Alert>
      ) : null}

      {activated !== null ? (
        <Alert
          role="status"
          className="border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]"
        >
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Master Profile updated</AlertTitle>
          <AlertDescription className="text-[var(--success)]">
            {activated} {activated === 1 ? "record is" : "records are"} now active and available to future analyses.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="profile-review-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-primary">
              Review before saving
            </p>
            <h2 id="profile-review-heading" className="mt-2 text-xl font-semibold tracking-[var(--tracking-tight)] text-foreground">
              Proposed profile records
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              New facts are preselected. Select updates or conflicts only after
              checking them. Known facts are kept unchanged.
            </p>
          </div>
          {currentImport?.status === "staged" ? (
            <Button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => void activateProfile()}
              className="w-full bg-[var(--success-solid)] text-[var(--success-solid-foreground)] hover:bg-[color-mix(in_oklch,var(--success-solid),black_10%)] sm:w-auto"
            >
              <ShieldCheck aria-hidden="true" data-icon="inline-start" />
              Activate {selected.size} selected {selected.size === 1 ? "record" : "records"}
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div role="status" aria-label="Loading your profile review" className="mt-5 space-y-4">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="mt-5 h-16 w-full" />
              </div>
            ))}
            <span className="sr-only">Loading your profile review…</span>
          </div>
        ) : groups.length ? (
          <div className="mt-5 space-y-4">
            {groups.map((group) => (
              <details
                key={group.type}
                open
                className="group overflow-hidden rounded-xl border border-border bg-card shadow-xs"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-semibold capitalize text-foreground marker:content-none">
                  <span>{group.type.replaceAll("_", " ")}</span>
                  <span className="flex items-center gap-3">
                    <Badge variant="secondary">{group.records.length}</Badge>
                    <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                  {group.records.map((candidate) => (
                    <article
                      key={candidate.id}
                      className="flex min-h-14 items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface-raised)]"
                    >
                      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center has-[:disabled]:cursor-default">
                        <input
                          type="checkbox"
                          aria-labelledby={`candidate-${candidate.id}`}
                          checked={selected.has(candidate.id)}
                          disabled={currentImport?.status !== "staged"}
                          onChange={(event) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(candidate.id);
                              else next.delete(candidate.id);
                              return next;
                            })
                          }
                          className="size-5 rounded border-2 border-input accent-[var(--primary)] disabled:opacity-50"
                        />
                        <span className="sr-only">Select {candidate.title}</span>
                      </label>
                      <span className="min-w-0 flex-1 pt-2">
                        <span
                          id={`candidate-${candidate.id}`}
                          className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground"
                        >
                          {candidate.title}
                          <Badge variant="outline" className={badgeClass(candidate.reconciliation)}>
                            {reconciliationLabel(candidate.reconciliation)}
                          </Badge>
                        </span>
                        <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">
                          {candidate.statement}
                        </span>
                        {candidate.structured_data.proficiency ? (
                          <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                            Proposed level:{" "}
                            <strong className="capitalize text-foreground">
                              {candidate.structured_data.proficiency}
                            </strong>
                            {candidate.structured_data.proficiencyBasis
                              ? ` — ${candidate.structured_data.proficiencyBasis}`
                              : ""}
                          </span>
                        ) : null}
                        <details className="group/source mt-2 text-xs text-muted-foreground">
                          <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-1.5 font-medium text-primary marker:content-none">
                            View source
                            <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open/source:rotate-180" />
                          </summary>
                          <p className="mb-2 whitespace-pre-wrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 leading-5 text-foreground">
                            {candidate.source_excerpt}
                          </p>
                        </details>
                      </span>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 py-10 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--primary-muted)] text-[var(--primary-muted-foreground)]">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold text-foreground">No records waiting for review</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Add a career story above. Waypoint will organize it into proposed
              records for you to inspect before anything is activated.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function reconciliationLabel(value: Candidate["reconciliation"]) {
  return {
    new: "New",
    update_existing: "Update existing",
    already_known: "Already known",
    possible_conflict: "Possible conflict",
  }[value];
}

function badgeClass(value: Candidate["reconciliation"]) {
  return {
    new: "border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]",
    update_existing:
      "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]",
    already_known:
      "border-[var(--border-default)] bg-[var(--surface-sunken)] text-muted-foreground",
    possible_conflict:
      "border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]",
  }[value];
}
