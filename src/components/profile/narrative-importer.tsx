"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
      .catch(() => undefined);
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-slate-950">
          Add to your Master Profile
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Add one topic at a time or paste a longer narrative. Waypoint compares
          it with your existing profile and proposes additions, updates,
          duplicates or conflicts. Nothing changes until you approve it.
        </p>
        <form onSubmit={generate} className="mt-5">
          <textarea
            value={narrative}
            onChange={(event) => setNarrative(event.target.value)}
            minLength={100}
            maxLength={12000}
            required
            rows={16}
            placeholder="For example: describe your development experience, then later add a separate paragraph about your UI/UX process…"
            className="w-full rounded-xl border border-slate-300 p-4 text-sm leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {narrative.length.toLocaleString()} / 12,000 characters
            </span>
            <button
              disabled={busy || narrative.trim().length < 100}
              className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Structuring profile…" : "Create review"}
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {activated !== null ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Master Profile activated with {activated} records.
        </p>
      ) : null}

      {groups.length ? (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Grouped profile review
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                New facts are preselected. Updates and conflicts require you to
                select them explicitly; already-known facts are not rewritten.
              </p>
            </div>
            {currentImport?.status === "staged" ? (
              <button
                disabled={busy || selected.size === 0}
                onClick={() => void activateProfile()}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Activate {selected.size} selected records
              </button>
            ) : null}
          </div>
          <div className="mt-5 space-y-5">
            {groups.map((group) => (
              <details
                key={group.type}
                open
                className="rounded-2xl border border-slate-200 bg-white"
              >
                <summary className="cursor-pointer list-none p-5 font-semibold capitalize text-slate-950">
                  {group.type.replaceAll("_", " ")} · {group.records.length}
                </summary>
                <div className="divide-y divide-slate-100 border-t border-slate-100 px-5">
                  {group.records.map((candidate) => (
                    <label
                      key={candidate.id}
                      className="flex cursor-pointer items-start gap-3 py-4"
                    >
                      <input
                        type="checkbox"
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
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">
                          {candidate.title}
                          <span
                            className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass(candidate.reconciliation)}`}
                          >
                            {reconciliationLabel(candidate.reconciliation)}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-slate-600">
                          {candidate.statement}
                        </span>
                        {candidate.structured_data.proficiency ? (
                          <span className="mt-2 block text-xs text-slate-600">
                            Proposed level:{" "}
                            <strong className="capitalize text-slate-800">
                              {candidate.structured_data.proficiency}
                            </strong>
                            {candidate.structured_data.proficiencyBasis
                              ? ` — ${candidate.structured_data.proficiencyBasis}`
                              : ""}
                          </span>
                        ) : null}
                        <details className="mt-2 text-xs text-slate-500">
                          <summary className="cursor-pointer text-indigo-700">
                            View source
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 leading-5">
                            {candidate.source_excerpt}
                          </p>
                        </details>
                      </span>
                    </label>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
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
    new: "bg-emerald-50 text-emerald-700",
    update_existing: "bg-amber-50 text-amber-700",
    already_known: "bg-slate-100 text-slate-600",
    possible_conflict: "bg-red-50 text-red-700",
  }[value];
}
