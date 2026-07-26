"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { KnowledgeLibraryItem } from "@/application/knowledge-library";
import type { KnowledgeLibrarySection } from "@/application/knowledge-library";

export function KnowledgeLibrary({
  sections,
}: {
  sections: KnowledgeLibrarySection[];
}) {
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const populated = useMemo(
    () => sections.filter((section) => section.items.length > 0),
    [sections],
  );
  const visibleSections = useMemo(() => {
    const term = query.trim().toLowerCase();
    return populated
      .filter(
        (section) =>
          selectedGroup === "all" || section.key === selectedGroup,
      )
      .map((section) => ({
        ...section,
        items: term
          ? section.items.filter((item) =>
              searchableText(item).includes(term),
            )
          : section.items,
      }))
      .filter((section) => section.items.length > 0);
  }, [populated, query, selectedGroup]);
  const total = populated.reduce(
    (count, section) => count + section.items.length,
    0,
  );
  const confirmed = populated.reduce(
    (count, section) =>
      count +
      section.items.filter((item) => item.status === "confirmed").length,
    0,
  );
  const visibleTotal = visibleSections.reduce(
    (count, section) => count + section.items.length,
    0,
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Stored knowledge" value={total} />
        <Metric label="Confirmed records" value={confirmed} />
        <Metric label="Knowledge groups" value={populated.length} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_15rem]">
          <label>
            <span className="sr-only">Search career knowledge</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills, projects, experience or facts…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label>
            <span className="sr-only">Filter by knowledge group</span>
            <select
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All knowledge groups</option>
              {populated.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.title} ({section.items.length})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Showing {visibleTotal} of {total} records
          </p>
          {query || selectedGroup !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedGroup("all");
              }}
              className="text-xs font-medium text-indigo-700 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {visibleSections.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-medium text-slate-900">No matching knowledge</h2>
          <p className="mt-2 text-sm text-slate-600">
            Try a broader search or clear the selected group.
          </p>
        </section>
      ) : null}

      {visibleSections.map((section) => (
        <section
          id={section.key}
          key={section.key}
          className="scroll-mt-6"
        >
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                {section.title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {section.description}
              </p>
            </div>
            <span className="shrink-0 text-sm text-slate-500">
              {section.items.length} records
            </span>
          </div>
          <SectionItems section={section} />
        </section>
      ))}
    </div>
  );
}

function SectionItems({ section }: { section: KnowledgeLibrarySection }) {
  if (!["skills", "competencies"].includes(section.key)) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {section.items.map((item) => (
          <KnowledgeCard key={item.id} sectionKey={section.key} item={item} />
        ))}
      </div>
    );
  }
  if (section.key === "competencies") {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {section.items.map((item) => (
          <KnowledgeCard
            key={item.id}
            sectionKey="competencies"
            item={item}
          />
        ))}
      </div>
    );
  }
  const groups = ["Development", "Design & UX", "Tools & platforms", "Collaboration & delivery", "Other"];
  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const items = section.items.filter((item) => skillGroup(item) === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{group}</h3>
              <span className="text-xs text-slate-400">{items.length} skills</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => (
                <KnowledgeCard key={item.id} sectionKey="skills" item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KnowledgeCard({
  sectionKey,
  item,
}: {
  sectionKey: string;
  item: KnowledgeLibraryItem;
}) {
  const [editing, setEditing] = useState(false);
  const category = ["skills", "competencies"].includes(sectionKey)
    ? knowledgeCategory(item)
    : null;
  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-white p-4 lg:col-span-2">
        <KnowledgeEditor
          sectionKey={sectionKey}
          item={item}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-slate-950">{item.title}</h3>
          {category ? (
            <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {category}
            </span>
          ) : null}
          {item.summary ? (
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
              {item.summary}
            </p>
          ) : null}
          {["skills", "competencies"].includes(sectionKey) ? (
            <SkillLevel item={item} />
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs capitalize text-emerald-700">
          {item.status}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          Edit
        </button>
      </div>
    </article>
  );
}

function searchableText(item: KnowledgeLibraryItem) {
  const details = item.details;
  const values = [
    item.title,
    item.summary ?? "",
    item.tags.join(" "),
    details.name,
    details.category,
    details.primary_category,
    details.aliases,
    details.title,
    details.narrative,
    details.organisation,
    details.value,
  ];
  return values
    .map((value) =>
      typeof value === "string" ? value : JSON.stringify(value ?? ""),
    )
    .join(" ")
    .toLowerCase();
}

function knowledgeCategory(item: KnowledgeLibraryItem) {
  const value = String(
    item.details.primary_category ?? item.details.category ?? "",
  );
  return value
    ? value
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : null;
}

function SkillLevel({ item }: { item: KnowledgeLibraryItem }) {
  const capability =
    typeof item.details.capability === "object" &&
    item.details.capability !== null &&
    !Array.isArray(item.details.capability)
      ? (item.details.capability as Record<string, unknown>)
      : null;
  const level =
    typeof capability?.current_level === "string"
      ? capability.current_level
      : "not_assessed";
  const percentages: Record<string, number> = {
    learning: 20,
    basic: 40,
    working: 60,
    strong: 80,
    expert: 100,
  };
  const percentage = percentages[level] ?? 0;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Your level</span>
        <span className="font-medium capitalize text-slate-700">
          {level === "not_assessed" ? "Not assessed" : level}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function skillGroup(item: KnowledgeLibraryItem) {
  const category = String(
    item.details.primary_category ?? item.details.category ?? "",
  )
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
  if (
    ["design_tool", "ux_method", "design_skill", "product_design"].includes(
      category,
    )
  ) {
    return "Design & UX";
  }
  if (
    ["tool", "platform", "database", "cloud_service"].includes(category)
  ) {
    return "Tools & platforms";
  }
  if (["interpersonal", "methodology"].includes(category)) {
    return "Collaboration & delivery";
  }
  if (
    [
      "frontend_development",
      "mobile_development",
      "programming_language",
      "software_engineering",
      "technical",
      "technical_skill",
      "framework",
      "library",
      "architecture",
    ].includes(category)
  ) {
    return "Development";
  }
  return "Other";
}

function KnowledgeEditor({
  sectionKey,
  item,
  onCancel,
}: {
  sectionKey: string;
  item: KnowledgeLibraryItem;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => initialForm(sectionKey, item));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/knowledge/${sectionKey}/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Save failed.");
      }
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-950">Edit {item.title}</h4>
          <p className="mt-1 text-xs text-slate-600">
            Changes update the confirmed Master Profile used for job analysis.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          Unsaved
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <FieldLabel>Title</FieldLabel>
          <input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            className={fieldClass}
          />
        </label>
        <label className="sm:col-span-2">
          <FieldLabel>Description</FieldLabel>
          <textarea
            rows={3}
            value={form.statement}
            onChange={(event) =>
              setForm({ ...form, statement: event.target.value })
            }
            className={fieldClass}
          />
        </label>
        {sectionKey === "skills" ? (
          <label className="sm:col-span-2">
            <FieldLabel>Your current proficiency</FieldLabel>
            <select
              value={form.capabilityLevel}
              onChange={(event) =>
                setForm({ ...form, capabilityLevel: event.target.value })
              }
              className={fieldClass}
            >
              <option value="not_assessed">Not assessed</option>
              <option value="learning">Learning</option>
              <option value="basic">Basic</option>
              <option value="working">Working proficiency</option>
              <option value="strong">Strong</option>
              <option value="expert">Expert</option>
            </select>
          </label>
        ) : null}
        <label className="sm:col-span-2">
          <FieldLabel>Tags (comma separated)</FieldLabel>
          <input
            value={form.tags}
            onChange={(event) =>
              setForm({ ...form, tags: event.target.value })
            }
            className={fieldClass}
          />
        </label>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          disabled={saving}
          onClick={() => {
            setError(null);
            onCancel();
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function initialForm(sectionKey: string, item: KnowledgeLibraryItem) {
  const details = item.details;
  const structured =
    typeof details.structured_data === "object" &&
    details.structured_data !== null &&
    !Array.isArray(details.structured_data)
      ? (details.structured_data as Record<string, unknown>)
      : {};
  const capability =
    typeof details.capability === "object" &&
    details.capability !== null &&
    !Array.isArray(details.capability)
      ? (details.capability as Record<string, unknown>)
      : {};
  return {
    title:
      typeof details.title === "string" ? details.title : item.title,
    statement:
      typeof details.statement === "string"
        ? details.statement
        : item.summary ?? "",
    tags: Array.isArray(structured.tags) ? structured.tags.join(", ") : "",
    capabilityLevel:
      typeof capability.current_level === "string"
        ? capability.current_level
        : "not_assessed",
  };
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
