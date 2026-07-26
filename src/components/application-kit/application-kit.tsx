"use client";

import { useEffect, useState } from "react";

import type { ApplicationKitSection } from "@/infrastructure/application-kit/application-kit";
import { buttonStyles } from "@/components/ui";

export function ApplicationKit() {
  const [sections, setSections] = useState<ApplicationKitSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => current === id ? null : current), 1600);
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
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Preparing your Application Kit…</div>;
  }
  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Sections" value={sections.length} />
        <Metric label="Saved answers" value={sections.flatMap((section) => section.items).filter((item) => item.value).length} />
        <Metric label="Still to complete" value={sections.flatMap((section) => section.items).filter((item) => !item.value).length} />
      </div>

      {sections.map((section) => (
        <section key={section.id}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              {editingSection === section.id ? (
                <SectionTitleEditor
                  title={section.title}
                  onCancel={() => setEditingSection(null)}
                  onSave={(title) => saveSection(section.id, title)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                    onClick={() => setEditingSection(section.id)}
                  >
                    Edit heading
                  </button>
                </div>
              )}
              {section.description ? (
                <p className="mt-1 text-sm text-slate-600">{section.description}</p>
              ) : null}
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
              {section.sectionType}
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
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
                <article key={item.id} className="flex min-h-32 flex-col rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium text-slate-900">{item.label}</h3>
                    {item.sourceKind !== "manual" ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-500">
                        {item.sourceKind}
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-2 flex-1 whitespace-pre-wrap text-sm leading-6 ${item.value ? "text-slate-700" : "italic text-slate-400"}`}>
                    {item.value || "Not added yet"}
                  </p>
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      onClick={() => setEditingItem(item.id)}
                    >
                      {item.value ? "Edit" : "Add answer"}
                    </button>
                    {item.value ? (
                      <button
                        type="button"
                        className="rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        onClick={() => void copy(item.id, item.value)}
                      >
                        {copiedId === item.id ? "Copied" : "Copy"}
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
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
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void onSave(value).finally(() => setBusy(false));
      }}
    >
      <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={value} onChange={(event) => setValue(event.target.value)} required maxLength={100} />
      <button className={buttonStyles.primary} disabled={busy}>Save</button>
      <button className={buttonStyles.secondary} type="button" onClick={onCancel}>Cancel</button>
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
      className="rounded-xl border border-indigo-200 bg-white p-4 lg:col-span-2"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        void onSave(nextLabel, nextValue)
          .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not save."))
          .finally(() => setBusy(false));
      }}
    >
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        Question or field
        <input className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm normal-case tracking-normal text-slate-900" value={nextLabel} onChange={(event) => setNextLabel(event.target.value)} required />
      </label>
      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
        Copy-ready answer
        <textarea className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm leading-6 normal-case tracking-normal text-slate-900" rows={5} value={nextValue} onChange={(event) => setNextValue(event.target.value)} />
      </label>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button className={buttonStyles.secondary} type="button" onClick={onCancel}>Cancel</button>
        <button className={buttonStyles.primary} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}

