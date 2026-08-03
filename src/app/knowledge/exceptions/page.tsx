import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CareerProfileNav } from "@/components/profile/career-profile-nav";
import { PageContainer, PageHeader, buttonStyles } from "@/components/ui";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";

export const metadata: Metadata = {
  title: "Knowledge exceptions",
  description: "Inspect facts Waypoint deliberately kept out of active knowledge.",
};
export const dynamic = "force-dynamic";

export default async function KnowledgeExceptionsPage() {
  const { actor, client } = await requireAuthenticatedContext();
  const { data, error } = await client
    .from("knowledge_exceptions")
    .select("id,reason,status,candidate,details,created_at")
    .eq("user_id", actor.userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("Unable to load knowledge exceptions.", { cause: error });
  }
  const exceptions = data ?? [];
  const open = exceptions.filter((item) => item.status === "open");

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Career Profile"
        title="Needs attention"
        description="Review information Waypoint could not safely add because it was conflicting, incomplete or structurally invalid."
        actions={
          <Link href="/knowledge" className={buttonStyles.secondary}>
            Back to profile
          </Link>
        }
      />
      <CareerProfileNav />
      <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{open.length}</span> open{" "}
          {open.length === 1 ? "item" : "items"}
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          Kept out of your active profile
        </span>
      </div>
      {open.length ? (
        <div className="space-y-4">
          {open.map((item, index) => (
            <article
              key={String(item.id)}
              aria-labelledby={`exception-${index}-title`}
              className="overflow-hidden rounded-xl border border-[var(--warning-border)] bg-card shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--warning-background)] text-[var(--warning)]">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--warning)]">
                      Review needed
                    </p>
                    <h2
                      id={`exception-${index}-title`}
                      className="mt-1 font-semibold capitalize text-foreground"
                    >
                      {String(item.reason).replaceAll("_", " ")}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Detected{" "}
                      <time dateTime={String(item.created_at)}>
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(String(item.created_at)))}
                      </time>
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-background)] px-2.5 py-1 text-xs font-medium text-[var(--warning)]">
                  Not active
                </span>
              </div>
              <details className="group border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                <summary className="flex min-h-11 cursor-pointer items-center px-5 py-3 text-sm font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35 sm:px-6">
                  View captured information and validation details
                </summary>
                <div className="grid gap-4 border-t border-[var(--border-subtle)] p-5 sm:p-6 lg:grid-cols-2">
                  <TechnicalPayload label="Captured information" value={item.candidate} />
                  <TechnicalPayload label="Validation details" value={item.details} />
                </div>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-[var(--success-border)] bg-card px-6 py-10 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-[var(--success-background)] text-[var(--success)]">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold text-foreground">Nothing needs your attention</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            All processed information passed validation. Waypoint has not found anything that
            needs to be kept out of your active Career Profile.
          </p>
        </section>
      )}
    </PageContainer>
  );
}

function TechnicalPayload({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-muted-foreground">
        {label}
      </h3>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 font-mono text-xs leading-6 text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
