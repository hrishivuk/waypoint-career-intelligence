"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  categoryLabel,
  categoryOptions,
  confirmationLabel,
  normaliseFact,
  type FactConfirmation,
  type ProfileFact,
  type ProfileFactCategory,
} from "./profile-facts";

type RequestState = "idle" | "loading" | "saving";

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string | { message?: string };
      message?: string;
    };
    if (typeof data.error === "string") return data.error;
    return (
      data.error?.message ??
      data.message ??
      `Request failed (${response.status})`
    );
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

function factsFromResponse(
  response: ProfileFact[] | { fact?: ProfileFact; facts?: ProfileFact[] },
): ProfileFact[] {
  if (Array.isArray(response)) return response.map(normaliseFact);
  if (response.facts) return response.facts.map(normaliseFact);
  if (response.fact) return [normaliseFact(response.fact)];
  return [];
}

export function ProfileOnboarding() {
  const [facts, setFacts] = useState<ProfileFact[]>([]);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] =
    useState<ProfileFactCategory>("career_goal");
  const [statement, setStatement] = useState("");

  const loadFacts = useCallback(async () => {
    setRequestState("loading");
    setError(null);
    try {
      const response = await requestJson<
        ProfileFact[] | { facts: ProfileFact[] }
      >("/api/v1/profile/facts");
      setFacts(factsFromResponse(response));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load your profile.",
      );
    } finally {
      setRequestState("idle");
    }
  }, []);

  useEffect(() => {
    let active = true;

    void requestJson<ProfileFact[] | { facts: ProfileFact[] }>(
      "/api/v1/profile/facts",
    )
      .then((response) => {
        if (active) setFacts(factsFromResponse(response));
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your profile.",
          );
        }
      })
      .finally(() => {
        if (active) setRequestState("idle");
      });

    return () => {
      active = false;
    };
  }, []);

  const groupedFacts = useMemo(
    () =>
      categoryOptions
        .map((option) => ({
          ...option,
          facts: facts.filter((fact) => fact.category === option.value),
        }))
        .filter((group) => group.facts.length > 0),
    [facts],
  );

  async function addFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanStatement = statement.trim();
    if (!cleanStatement) return;

    setRequestState("saving");
    setError(null);
    try {
      const response = await requestJson<
        ProfileFact | { fact: ProfileFact; facts?: ProfileFact[] }
      >("/api/v1/profile/facts", {
        method: "POST",
        body: JSON.stringify({
          category,
          statement: cleanStatement,
          tags: [],
        }),
      });
      const created = factsFromResponse(
        "id" in response ? [response] : response,
      );
      setFacts((current) =>
        response && "facts" in response && response.facts
          ? factsFromResponse(response)
          : [...created, ...current],
      );
      setStatement("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save that fact.",
      );
    } finally {
      setRequestState("idle");
    }
  }

  async function updateFact(
    fact: ProfileFact,
    changes: Partial<Pick<ProfileFact, "statement" | "confirmation">>,
  ) {
    setRequestState("saving");
    setError(null);
    try {
      const response = await requestJson<
        ProfileFact | { fact: ProfileFact; facts?: ProfileFact[] }
      >(`/api/v1/profile/facts/${fact.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      const returnedFacts = factsFromResponse(
        "id" in response ? [response] : response,
      );
      const updated = returnedFacts[0] ?? normaliseFact({ ...fact, ...changes });
      setFacts((current) =>
        current.map((item) => (item.id === fact.id ? updated : item)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update that fact.",
      );
    } finally {
      setRequestState("idle");
    }
  }

  return (
    <div className="space-y-10">
      <section
        aria-labelledby="add-fact-title"
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
      >
        <h2 id="add-fact-title" className="text-lg font-semibold text-slate-950">
          Add something the coach should know
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Add one clear fact at a time. You can review or change it below.
        </p>

        <form onSubmit={addFact} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="fact-category"
              className="block text-sm font-medium text-slate-800"
            >
              Area
            </label>
            <select
              id="fact-category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as ProfileFactCategory)
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              {categoryOptions.find((option) => option.value === category)?.prompt}
            </p>
          </div>

          <div>
            <label
              htmlFor="fact-statement"
              className="block text-sm font-medium text-slate-800"
            >
              What should it remember?
            </label>
            <textarea
              id="fact-statement"
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              required
              rows={3}
              maxLength={2000}
              placeholder="For example: I prefer product-focused roles where I can work closely with users."
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-950 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <button
            type="submit"
            disabled={requestState !== "idle" || !statement.trim()}
            className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requestState === "saving" ? "Saving…" : "Add to profile"}
          </button>
        </form>
      </section>

      <section aria-labelledby="profile-facts-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="profile-facts-title"
              className="text-lg font-semibold text-slate-950"
            >
              Your profile facts
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Confirmed facts can be used as trusted evidence.
            </p>
          </div>
          <p className="text-sm text-slate-500">{facts.length} total</p>
        </div>

        <div aria-live="polite" className="mt-5">
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadFacts()}
                className="mt-2 font-medium underline underline-offset-2"
              >
                Try loading again
              </button>
            </div>
          ) : null}

          {requestState === "loading" ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Loading your career profile…
            </p>
          ) : null}

          {requestState !== "loading" && facts.length === 0 && !error ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="font-medium text-slate-900">
                Your profile is empty
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Add your first goal, preference, skill, or experience above.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-8">
          {groupedFacts.map((group) => (
            <section key={group.value} aria-labelledby={`group-${group.value}`}>
              <div className="border-b border-slate-200 pb-2">
                <h3
                  id={`group-${group.value}`}
                  className="font-semibold text-slate-900"
                >
                  {group.label}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">{group.prompt}</p>
              </div>
              <ul className="mt-3 space-y-3">
                {group.facts.map((fact) => (
                  <li key={fact.id}>
                    <ProfileFactCard
                      fact={fact}
                      disabled={requestState === "saving"}
                      onUpdate={updateFact}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileFactCard({
  fact,
  disabled,
  onUpdate,
}: {
  fact: ProfileFact;
  disabled: boolean;
  onUpdate: (
    fact: ProfileFact,
    changes: Partial<Pick<ProfileFact, "statement" | "confirmation">>,
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fact.statement);

  const statusStyles: Record<FactConfirmation, string> = {
    proposed: "border-amber-200 bg-amber-50 text-amber-800",
    confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-slate-200 bg-slate-100 text-slate-600",
    superseded: "border-slate-200 bg-slate-100 text-slate-600",
    stale: "border-orange-200 bg-orange-50 text-orange-800",
  };

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanDraft = draft.trim();
    if (!cleanDraft || cleanDraft === fact.statement) {
      setDraft(fact.statement);
      setEditing(false);
      return;
    }
    await onUpdate(fact, { statement: cleanDraft });
    setEditing(false);
  }

  return (
    <article
      className={`rounded-xl border bg-white p-4 ${
        fact.confirmation === "rejected"
          ? "border-slate-200 opacity-70"
          : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[fact.confirmation]}`}
        >
          {confirmationLabel[fact.confirmation]}
        </span>
        <span className="sr-only">
          Category: {categoryLabel.get(fact.category)}
        </span>
      </div>

      {editing ? (
        <form onSubmit={saveEdit} className="mt-3">
          <label htmlFor={`edit-${fact.id}`} className="sr-only">
            Edit {categoryLabel.get(fact.category)} fact
          </label>
          <textarea
            id={`edit-${fact.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            required
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={disabled || !draft.trim()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(fact.statement);
                setEditing(false);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
          {fact.statement}
        </p>
      )}

      {!editing ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {fact.confirmation === "proposed" ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void onUpdate(fact, { confirmation: "confirmed" })
              }
              className="rounded-md border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-800 disabled:opacity-50"
            >
              Confirm
            </button>
          ) : null}
          {fact.confirmation === "proposed" ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void onUpdate(fact, { confirmation: "rejected" })
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Reject
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="rounded-md px-3 py-2 text-xs font-medium text-slate-700 underline-offset-2 hover:underline disabled:opacity-50"
          >
            Edit
          </button>
        </div>
      ) : null}
    </article>
  );
}
