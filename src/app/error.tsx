"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Waypoint page failed", {
      digest: error.digest,
      category: error.name,
    });
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[65vh] w-full max-w-2xl items-center px-4 py-16 sm:px-6"
    >
      <section
        aria-labelledby="error-title"
        className="w-full rounded-2xl border border-[var(--danger-border)] bg-card p-6 shadow-sm sm:p-9"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--danger-background)] text-[var(--danger)]">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-semibold text-[var(--danger)]">
          We could not load this page
        </p>
        <h1
          id="error-title"
          className="mt-2 text-3xl font-semibold tracking-tight text-foreground"
        >
          Something went wrong.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          Your saved information has not been changed. The problem may be temporary, so try
          loading this page again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </button>
        {error.digest ? (
          <p className="mt-5 font-mono text-xs text-[var(--text-tertiary)]">
            Reference: {error.digest}
          </p>
        ) : null}
      </section>
    </main>
  );
}
