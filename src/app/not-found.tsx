import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[65vh] w-full max-w-2xl items-center px-4 py-16 sm:px-6"
    >
      <section
        aria-labelledby="not-found-title"
        className="w-full rounded-2xl border border-[var(--border-subtle)] bg-card p-6 shadow-sm sm:p-9"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--primary-muted)] text-primary">
          <Compass className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-6 font-mono text-sm font-semibold text-primary">404 / NOT FOUND</p>
        <h1
          id="not-found-title"
          className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          This page is off the map.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          The address may be outdated, or the page may have moved. Return to Waypoint to
          continue your work.
        </p>
        <Link href="/" className={`${buttonStyles.primary} mt-7 gap-2`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Return to Waypoint
        </Link>
      </section>
    </main>
  );
}
