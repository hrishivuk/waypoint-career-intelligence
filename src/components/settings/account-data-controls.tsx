"use client";

import { useState } from "react";

import { buttonStyles } from "@/components/ui";

export function AccountDataControls() {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeAccount() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete your account.");
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-950">Export your information</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Download a ZIP containing your structured Waypoint data and original CV files. Provider credentials and private storage paths are never included.</p>
      <a href="/api/v1/account/export" className={`${buttonStyles.secondary} mt-4`}>Download account export</a>
    </section>
    <section className="rounded-xl border border-red-200 bg-red-50 p-5">
      <h2 className="font-semibold text-red-950">Delete account permanently</h2>
      <p className="mt-2 text-sm leading-6 text-red-800">This removes your uploaded files, encrypted provider credentials, career knowledge, analyses, application content, and sign-in identity. It cannot be undone. If your session is older than 15 minutes, sign out and sign in again first.</p>
      <label className="mt-4 block text-sm font-medium text-red-950">Type DELETE MY ACCOUNT to confirm
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-2 block min-h-11 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm" />
      </label>
      {error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}
      <button type="button" disabled={busy || confirmation !== "DELETE MY ACCOUNT"} onClick={() => void removeAccount()} className="mt-4 min-h-11 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">{busy ? "Deleting…" : "Delete my account"}</button>
    </section>
  </div>;
}
