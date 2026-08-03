"use client";

import { useState } from "react";
import { AlertTriangle, Archive, Download, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";

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

  return (
    <div className="space-y-6" aria-busy={busy}>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-start gap-3 p-5 sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--info-background)] text-[var(--info)]">
            <Archive aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold text-foreground">Export your information</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Download a ZIP containing your structured Waypoint data and
              original CV files. Provider credentials and private storage paths
              are never included.
            </p>
            <a
              href="/api/v1/account/export"
              className={`${buttonVariants({ variant: "outline" })} mt-4`}
            >
              <Download aria-hidden="true" data-icon="inline-start" />
              Download account export
            </a>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="delete-account-heading"
        className="overflow-hidden rounded-xl border border-[var(--danger-border)] bg-[var(--danger-background)]"
      >
        <div className="flex items-start gap-3 border-b border-[var(--danger-border)] p-5 sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-solid)] text-[var(--danger-solid-foreground)]">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-[var(--danger)]">
              Danger zone
            </p>
            <h3 id="delete-account-heading" className="mt-1 font-semibold text-[var(--danger)]">
              Delete account permanently
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--danger)]">
              This removes your uploaded files, encrypted provider credentials,
              career knowledge, analyses, application content, and sign-in
              identity. It cannot be undone.
            </p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm leading-6 text-[var(--danger)]">
            For security, a session older than 15 minutes must sign out and sign
            in again before deletion.
          </p>
          <label htmlFor="delete-account-confirmation" className="mt-4 block text-sm font-semibold text-[var(--danger)]">
            Type <span className="font-mono">DELETE MY ACCOUNT</span> to confirm
          </label>
          <input
            id="delete-account-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-2 block min-h-11 w-full max-w-xl rounded-lg border border-[var(--danger-border)] bg-[var(--surface-overlay)] px-3 py-2 font-mono text-sm text-foreground shadow-xs outline-none"
          />
          {error ? (
            <Alert
              variant="destructive"
              className="mt-4 border-[var(--danger-border)] bg-[var(--surface-overlay)] text-[var(--danger)]"
            >
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>Account deletion could not be completed</AlertTitle>
              <AlertDescription className="text-[var(--danger)]">{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="button"
            disabled={busy || confirmation !== "DELETE MY ACCOUNT"}
            onClick={() => void removeAccount()}
            className="mt-4 bg-[var(--danger-solid)] text-[var(--danger-solid-foreground)] hover:bg-[color-mix(in_oklch,var(--danger-solid),black_10%)]"
          >
            <Trash2 aria-hidden="true" data-icon="inline-start" />
            {busy ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
      </section>
    </div>
  );
}
