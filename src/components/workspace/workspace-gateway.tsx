"use client";

import { useState } from "react";

export function WorkspaceGateway() {
  const [busy, setBusy] = useState<"personal" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(mode: "personal" | "demo") {
    setBusy(mode);
    setError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open workspace.");
      setBusy(null);
    }
  }

  return (
    <main id="main-content" className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Evidence-aware career intelligence
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">
            Choose how you want to explore Waypoint
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Open the private personal workspace or explore a guided,
            completely fictional demonstration with no external AI calls.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Private
            </span>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">Personal workspace</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
              Your real Master Profile, private CVs, Application Kit and live
              provider-assisted analysis. Public deployment will require your
              authenticated account.
            </p>
            <button
              className="mt-6 min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => void choose("personal")}
            >
              {busy === "personal" ? "Opening…" : "Open personal workspace"}
            </button>
          </article>

          <article className="flex flex-col rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
            <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-medium text-indigo-700">
              Public-safe
            </span>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">Guided showcase</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-700">
              Explore a fictional candidate, prepared CVs and deterministic
              job analysis. Nothing accesses personal data, Groq or OpenAI.
            </p>
            <button
              className="mt-6 min-h-11 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => void choose("demo")}
            >
              {busy === "demo" ? "Preparing demo…" : "Try the guided demo"}
            </button>
          </article>
        </div>
        {error ? (
          <p className="mx-auto mt-5 max-w-4xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
