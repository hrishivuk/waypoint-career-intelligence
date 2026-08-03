"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy as CopyIcon,
  Inbox,
  Layers3,
  Pencil,
  Sparkles,
} from "lucide-react";

import type { ApplicationKitSection } from "@/infrastructure/application-kit/application-kit";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ApplicationKit() {
  const [sections, setSections] = useState<ApplicationKitSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/application-kit", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setSections(body.sections);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function copy(id: string, value: string) {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(
        () => setCopiedId((current) => (current === id ? null : current)),
        1600,
      );
    } catch {
      setCopyError("Your browser could not copy this answer. Select the text and copy it manually.");
    }
  }

  async function saveSection(id: string, title: string) {
    const response = await fetch(`/api/v1/application-kit/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setSections((current) => current.map((section) =>
      section.id === id ? { ...section, title: body.section.title } : section
    ));
    setEditingSection(null);
  }

  async function saveItem(id: string, label: string, value: string) {
    const response = await fetch(`/api/v1/application-kit/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setSections((current) => current.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === id
          ? { ...item, label: body.item.label, value: body.item.value, sourceKind: "manual" }
          : item
      ),
    })));
    setEditingItem(null);
  }

  if (loading) {
    return (
      <div role="status" aria-label="Preparing your Application Kit" className="space-y-5">
        <div className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-[var(--border-subtle)]">
          {[0, 1, 2].map((item) => (
            <div key={item} className="p-4">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-5 h-28 w-full" />
        </div>
        <span className="sr-only">Preparing your Application Kit…</span>
      </div>
    );
  }
  if (error) {
    return (
      <Alert
        variant="destructive"
        className="border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]"
      >
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Your Application Kit could not be loaded</AlertTitle>
        <AlertDescription className="text-[var(--danger)]">{error}</AlertDescription>
      </Alert>
    );
  }

  const items = sections.flatMap((section) => section.items);
  const savedCount = items.filter((item) => item.value).length;
  const incompleteCount = items.length - savedCount;

  return (
    <div className="space-y-8">
      <section aria-label="Application Kit summary" className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] p-5 sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-muted)] text-[var(--primary-muted-foreground)]">
            <Layers3 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">Application readiness</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Fill reusable details once, then copy the answer you need into an application form.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 sm:divide-x sm:divide-[var(--border-subtle)]">
        <Metric label="Sections" value={sections.length} />
        <Metric label="Saved answers" value={savedCount} />
        <Metric label="Still to complete" value={incompleteCount} />
        </div>
      </section>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {copiedId ? "Answer copied to clipboard." : copyError ?? ""}
      </div>
      {copyError ? (
        <Alert className="border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Copy was unavailable</AlertTitle>
          <AlertDescription className="text-[var(--warning)]">{copyError}</AlertDescription>
        </Alert>
      ) : null}

      {sections.length ? sections.map((section) => (
        <section key={section.id} aria-label={section.title} className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div>
              {editingSection === section.id ? (
                <SectionTitleEditor
                  title={section.title}
                  onCancel={() => setEditingSection(null)}
                  onSave={(title) => saveSection(section.id, title)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`section-${section.id}`} className="text-xl font-semibold tracking-[var(--tracking-tight)] text-foreground">{section.title}</h2>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditingSection(section.id)}
                  >
                    <Pencil aria-hidden="true" data-icon="inline-start" />
                    Edit heading
                  </Button>
                </div>
              )}
              {section.description ? (
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{section.description}</p>
              ) : null}
            </div>
            <Badge variant="secondary" className="capitalize">
              {section.sectionType}
            </Badge>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {section.items.map((item) => (
              editingItem === item.id ? (
                <ItemEditor
                  key={item.id}
                  label={item.label}
                  value={item.value}
                  onCancel={() => setEditingItem(null)}
                  onSave={(label, value) => saveItem(item.id, label, value)}
                />
              ) : (
                <article key={item.id} className="grid gap-4 p-5 transition-colors hover:bg-[var(--surface-raised)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{item.label}</h3>
                    {item.sourceKind !== "manual" ? (
                      <Badge variant="outline" className="capitalize text-muted-foreground">
                        {item.sourceKind}
                      </Badge>
                    ) : null}
                    </div>
                    <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${item.value ? "text-muted-foreground" : "italic text-[var(--text-tertiary)]"}`}>
                      {item.value || "Not added yet"}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:flex sm:items-center sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingItem(item.id)}
                    >
                      <Pencil aria-hidden="true" data-icon="inline-start" />
                      {item.value ? "Edit" : "Add answer"}
                    </Button>
                    {item.value ? (
                      <Button
                        type="button"
                        variant={copiedId === item.id ? "secondary" : "default"}
                        onClick={() => void copy(item.id, item.value)}
                      >
                        {copiedId === item.id ? <Check aria-hidden="true" data-icon="inline-start" /> : <CopyIcon aria-hidden="true" data-icon="inline-start" />}
                        {copiedId === item.id ? "Copied" : "Copy"}
                      </Button>
                    ) : null}
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      )) : (
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 py-10 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--primary-muted)] text-[var(--primary-muted-foreground)]">
            <Inbox aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold text-foreground">Your Application Kit is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            No reusable sections are available yet. Refresh the page to retry preparing your starter kit.
          </p>
          <Button type="button" variant="outline" className="mt-5" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[var(--border-subtle)] p-4 last:border-b-0 sm:border-b-0 sm:p-5">
      <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionTitleEditor({
  title,
  onCancel,
  onSave,
}: {
  title: string;
  onCancel: () => void;
  onSave: (title: string) => Promise<void>;
}) {
  const [value, setValue] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        void onSave(value)
          .catch((cause) =>
            setError(cause instanceof Error ? cause.message : "Could not save the heading."),
          )
          .finally(() => setBusy(false));
      }}
    >
      <label className="block text-sm font-semibold text-foreground">
        Section heading
        <input className="mt-2 block min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-sm text-foreground shadow-xs outline-none" value={value} onChange={(event) => setValue(event.target.value)} required maxLength={100} />
      </label>
      {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="grid gap-2 sm:flex">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save heading"}</Button>
        <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function ItemEditor({
  label,
  value,
  onCancel,
  onSave,
}: {
  label: string;
  value: string;
  onCancel: () => void;
  onSave: (label: string, value: string) => Promise<void>;
}) {
  const [nextLabel, setNextLabel] = useState(label);
  const [nextValue, setNextValue] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="bg-[var(--ai-muted)] p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        void onSave(nextLabel, nextValue)
          .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not save."))
          .finally(() => setBusy(false));
      }}
    >
      <div className="flex items-center gap-2 text-[var(--ai-muted-foreground)]">
        <Sparkles aria-hidden="true" className="size-4" />
        <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)]">Edit reusable answer</p>
      </div>
      <label className="mt-4 block text-sm font-semibold text-foreground">
        Question or field
        <input className="mt-2 block min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 text-sm font-normal text-foreground shadow-xs outline-none" value={nextLabel} onChange={(event) => setNextLabel(event.target.value)} required />
      </label>
      <label className="mt-4 block text-sm font-semibold text-foreground">
        Copy-ready answer
        <textarea className="mt-2 block min-h-32 w-full resize-y rounded-lg border border-input bg-[var(--surface-overlay)] p-3 text-base font-normal leading-7 text-foreground shadow-xs outline-none" rows={5} value={nextValue} onChange={(event) => setNextValue(event.target.value)} />
      </label>
      {error ? <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
        <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
      </div>
    </form>
  );
}
