"use client";

import { useState } from "react";
import Link from "next/link";

export function PersonalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Private workspace</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Sign in to Waypoint</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This account contains private career knowledge and CV documents.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button disabled={busy} className="min-h-11 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link href="/" className="mt-5 block text-center text-sm font-medium text-slate-600 hover:text-indigo-700">Back to workspace selection</Link>
      </div>
    </main>
  );
}
