"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Library,
  Trash2,
  UploadCloud,
} from "lucide-react";

import type { CvSnapshot } from "@/domain/cv/cv-document";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CvWorkspace() {
  const [cvs, setCvs] = useState<CvSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/cvs", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) {
          setCvs(body.cvs);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load CVs.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function upload(formData: FormData) {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/cvs", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setCvs((current) => [body.cv, ...current]);
      setOpenId(body.cv.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload CV.");
    } finally {
      setWorking(false);
    }
  }

  async function remove(cv: CvSnapshot) {
    if (!window.confirm(`Delete “${cv.displayName}” and its stored file?`)) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/v1/cvs/${cv.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      setCvs((current) => current.filter((item) => item.id !== cv.id));
      if (openId === cv.id) setOpenId(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete CV.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        aria-labelledby="cv-upload-heading"
        aria-busy={working}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
        action={(data) => void upload(data)}
      >
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary-muted)] text-[var(--primary-muted-foreground)]">
              <UploadCloud aria-hidden="true" className="size-5" />
            </span>
            <h2 id="cv-upload-heading" className="mt-4 text-xl font-semibold tracking-[var(--tracking-tight)] text-foreground">
              Add a role-specific CV
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Keep each CV as a separate application document. Waypoint reads
              only the content visible in the uploaded file and does not change
              your Master Profile.
            </p>
          </div>
          <aside className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
            <p className="text-sm font-semibold text-foreground">Before you upload</p>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground">
              <li>Use PDF or DOCX, up to 10 MB</li>
              <li>Name the role or purpose clearly</li>
              <li>Parsing is deterministic and does not use AI</li>
            </ul>
          </aside>
        </div>
        <div className="grid gap-5 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 sm:p-7 md:grid-cols-2">
          <label className="text-sm font-semibold text-foreground">
            CV file
            <input
              className="mt-2 block min-h-11 w-full cursor-pointer rounded-lg border border-input bg-[var(--surface-overlay)] text-sm text-foreground shadow-xs file:mr-3 file:min-h-11 file:cursor-pointer file:border-0 file:border-r file:border-[var(--border-subtle)] file:bg-[var(--surface-sunken)] file:px-3 file:text-sm file:font-medium file:text-foreground"
              name="file"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
            />
          </label>
          <label className="text-sm font-semibold text-foreground">
            CV name
            <input
              className="mt-2 block min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-[var(--text-tertiary)]"
              name="displayName"
              placeholder="e.g. Frontend Engineer CV"
              maxLength={120}
            />
          </label>
          <label className="text-sm font-semibold text-foreground">
            Intended roles
            <input
              className="mt-2 block min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-[var(--text-tertiary)]"
              name="intendedRoles"
              placeholder="Frontend Engineer, UI Engineer"
            />
          </label>
          <label className="text-sm font-semibold text-foreground">
            Private note
            <input
              className="mt-2 block min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-[var(--text-tertiary)]"
              name="notes"
              placeholder="When this version should be used"
              maxLength={2000}
            />
          </label>
          <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted-foreground">
              Files stay private to your account. You can permanently remove them at any time.
            </p>
          <Button type="submit" className="w-full shrink-0 sm:w-auto" disabled={working}>
            <UploadCloud aria-hidden="true" data-icon="inline-start" />
            {working ? "Processing…" : "Upload and parse CV"}
          </Button>
          </div>
        </div>
      </form>

      {error ? (
        <Alert
          variant="destructive"
          className="border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]"
        >
          <AlertCircle aria-hidden="true" />
          <AlertTitle>CV workspace needs your attention</AlertTitle>
          <AlertDescription className="text-[var(--danger)]">{error}</AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="cv-library-heading" aria-busy={loading || working}>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-primary">Documents</p>
            <h2 id="cv-library-heading" className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[var(--tracking-tight)] text-foreground">
              <Library aria-hidden="true" className="size-5 text-primary" />
              CV library
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {cvs.length} separate application {cvs.length === 1 ? "document" : "documents"}
            </p>
          </div>
        </div>
        {loading ? (
          <div role="status" aria-label="Loading CV library" className="space-y-4">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="size-10 shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-52 max-w-full" />
                    <Skeleton className="mt-3 h-4 w-72 max-w-full" />
                  </div>
                </div>
              </div>
            ))}
            <span className="sr-only">Loading CV library…</span>
          </div>
        ) : cvs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 py-10 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--primary-muted)] text-[var(--primary-muted-foreground)]">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold text-foreground">No CVs stored yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Upload your first role-specific CV above. Parsed content and readiness will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cvs.map((cv) => {
              const open = openId === cv.id;
              const skills = cv.claims.filter((claim) => claim.claimType === "skill");
              return (
                <article key={cv.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-primary">
                          <FileText aria-hidden="true" className="size-5" />
                        </span>
                        <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground">{cv.displayName}</h3>
                          <Badge variant="outline" className={statusClass(cv.processingStatus)}>
                            {cv.processingStatus === "ready" ? <CheckCircle2 aria-hidden="true" /> : cv.processingStatus === "failed" ? <AlertCircle aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
                            {cv.processingStatus === "ready" ? "ATS parsed" : cv.processingStatus}
                          </Badge>
                        </div>
                        <p className="mt-1 break-words text-sm text-muted-foreground">
                          {cv.originalFilename} · {formatBytes(cv.byteSize)}
                          {cv.pageCount ? ` · ${cv.pageCount} pages` : ""}
                        </p>
                        {cv.intendedRoles.length ? (
                          <p className="mt-3 text-sm text-foreground">
                            <span className="font-medium">Best intended for:</span>{" "}
                            {cv.intendedRoles.join(", ")}
                          </p>
                        ) : null}
                        </div>
                      </div>
                      <div className="grid shrink-0 gap-2 sm:flex">
                        <Button
                          variant="outline"
                          onClick={() => setOpenId(open ? null : cv.id)}
                          type="button"
                        >
                          {open ? <EyeOff aria-hidden="true" data-icon="inline-start" /> : <Eye aria-hidden="true" data-icon="inline-start" />}
                          {open ? "Hide content" : "View CV content"}
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={working}
                          onClick={() => void remove(cv)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" data-icon="inline-start" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    {cv.processingError ? (
                      <Alert
                        variant="destructive"
                        className="mt-4 border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]"
                      >
                        <AlertCircle aria-hidden="true" />
                        <AlertTitle>Parsing failed</AlertTitle>
                        <AlertDescription className="text-[var(--danger)]">{cv.processingError}</AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 sm:p-6">
                      <div className="grid overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-card sm:grid-cols-3 sm:divide-x sm:divide-[var(--border-subtle)]">
                        <Metric label="Sections found" value={cv.sections.length} />
                        <Metric label="Visible skills" value={skills.length} />
                        <Metric label="Content items" value={cv.claims.length} />
                      </div>
                      <div className="mt-5 space-y-3">
                        {cv.sections.map((section) => (
                          <details key={section.id} className="group overflow-hidden rounded-lg border border-border bg-card">
                            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium capitalize text-foreground marker:content-none">
                              <span>{section.heading ?? section.sectionType}</span>
                              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                            </summary>
                            <p className="whitespace-pre-wrap border-t border-[var(--border-subtle)] px-4 py-4 text-sm leading-6 text-muted-foreground">
                              {section.content}
                            </p>
                          </details>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[var(--border-subtle)] p-4 last:border-b-0 sm:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function statusClass(status: CvSnapshot["processingStatus"]) {
  if (status === "ready") {
    return "border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]";
  }
  if (status === "failed") {
    return "border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]";
  }
  return "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]";
}
