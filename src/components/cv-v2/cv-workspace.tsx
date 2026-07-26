"use client";

import { useEffect, useState } from "react";

import type { CvSnapshot } from "@/domain/cv/cv-document";
import { buttonStyles } from "@/components/ui";

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
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        action={(data) => void upload(data)}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-800">
            CV file
            <input
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm"
              name="file"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-800">
            CV name
            <input
              className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              name="displayName"
              placeholder="e.g. Frontend Engineer CV"
              maxLength={120}
            />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Intended roles
            <input
              className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              name="intendedRoles"
              placeholder="Frontend Engineer, UI Engineer"
            />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Private note
            <input
              className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              name="notes"
              placeholder="When this version should be used"
              maxLength={2000}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-slate-500">
            PDF or DOCX, up to 10 MB. Parsing is deterministic and does not use AI.
          </p>
          <button className={buttonStyles.primary} disabled={working}>
            {working ? "Processing…" : "Upload and parse CV"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">CV library</h2>
            <p className="mt-1 text-sm text-slate-500">
              {cvs.length} separate application {cvs.length === 1 ? "document" : "documents"}
            </p>
          </div>
        </div>
        {loading ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Loading CV library…
          </p>
        ) : cvs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="font-semibold text-slate-950">No CVs stored yet</h3>
            <p className="mt-2 text-sm text-slate-600">
              Upload your first role-specific CV above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cvs.map((cv) => {
              const open = openId === cv.id;
              const skills = cv.claims.filter((claim) => claim.claimType === "skill");
              return (
                <article key={cv.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-950">{cv.displayName}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            cv.processingStatus === "ready"
                              ? "bg-emerald-50 text-emerald-700"
                              : cv.processingStatus === "failed"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                          }`}>
                            {cv.processingStatus === "ready" ? "ATS parsed" : cv.processingStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {cv.originalFilename} · {formatBytes(cv.byteSize)}
                          {cv.pageCount ? ` · ${cv.pageCount} pages` : ""}
                        </p>
                        {cv.intendedRoles.length ? (
                          <p className="mt-3 text-sm text-slate-700">
                            <span className="font-medium">Best intended for:</span>{" "}
                            {cv.intendedRoles.join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className={buttonStyles.secondary}
                          onClick={() => setOpenId(open ? null : cv.id)}
                          type="button"
                        >
                          {open ? "Hide content" : "View CV content"}
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          disabled={working}
                          onClick={() => void remove(cv)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {cv.processingError ? (
                      <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {cv.processingError}
                      </p>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Sections found</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-950">{cv.sections.length}</p>
                        </div>
                        <div className="rounded-xl bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Visible skills</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-950">{skills.length}</p>
                        </div>
                        <div className="rounded-xl bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Content items</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-950">{cv.claims.length}</p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-3">
                        {cv.sections.map((section) => (
                          <details key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
                            <summary className="cursor-pointer font-medium capitalize text-slate-900">
                              {section.heading ?? section.sectionType}
                            </summary>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
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
