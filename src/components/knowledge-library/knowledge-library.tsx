"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { KnowledgeLibraryItem } from "@/application/knowledge-library";
import type { KnowledgeLibrarySection } from "@/application/knowledge-library";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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
    <div className="space-y-10">
      <section
        aria-label="Knowledge summary"
        className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-border"
      >
        <Metric label="Stored knowledge" value={total} />
        <Metric label="Confirmed records" value={confirmed} />
        <Metric label="Knowledge groups" value={populated.length} />
      </section>

      <section
        aria-label="Filter career knowledge"
        className="rounded-xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_15rem]">
          <label>
            <span className="mb-2 block text-sm font-medium text-foreground">
              Search knowledge
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills, projects, experience or facts…"
              className={filterControlClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-foreground">
              Knowledge group
            </span>
            <select
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
              className={filterControlClass}
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
          <p aria-live="polite" className="text-xs text-muted-foreground">
            Showing {visibleTotal} of {total} records
          </p>
          {query || selectedGroup !== "all" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setSelectedGroup("all");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </section>

      {visibleSections.length === 0 ? (
        <section className="rounded-xl border border-dashed border-[var(--border-strong)] bg-card/60 px-6 py-12 text-center">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {total === 0
              ? "Your knowledge library is empty"
              : "No matching knowledge"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {total === 0
              ? "Add career evidence to build the trusted knowledge Waypoint uses for job decisions."
              : "Try a broader search, choose another group, or clear the current filters."}
          </p>
          {total > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => {
                setQuery("");
                setSelectedGroup("all");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </section>
      ) : null}

      {visibleSections.map((section) => (
        <section
          id={section.key}
          key={section.key}
          className="scroll-mt-24"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {section.title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {section.description}
              </p>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
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
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {section.items.map((item) => (
          <KnowledgeCard key={item.id} sectionKey={section.key} item={item} />
        ))}
      </div>
    );
  }
  if (section.key === "competencies") {
    return (
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
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
  const groups = [
    "Development",
    "Design & UX",
    "Tools & platforms",
    "Collaboration & delivery",
    "Other",
  ];
  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const items = section.items.filter((item) => skillGroup(item) === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="font-heading font-semibold text-foreground">
                {group}
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {items.length} skills
              </span>
            </div>
            <div className="grid items-stretch gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr))]">
              {items.map((item) => (
                <KnowledgeCard
                  key={item.id}
                  sectionKey="skills"
                  item={item}
                  display="card"
                />
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
  display = "row",
}: {
  sectionKey: string;
  item: KnowledgeLibraryItem;
  display?: "row" | "card";
}) {
  const [editing, setEditing] = useState(false);
  const isCard = display === "card";
  const category = ["skills", "competencies"].includes(sectionKey)
    ? knowledgeCategory(item)
    : null;
  if (editing) {
    return (
      <div
        className={
          isCard
            ? "h-full overflow-hidden rounded-xl border border-border bg-[var(--surface-raised)] p-4 sm:p-5"
            : "bg-[var(--surface-raised)] p-4 sm:p-5"
        }
      >
        <KnowledgeEditor
          sectionKey={sectionKey}
          item={item}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <article
      className={
        isCard
          ? "flex h-full flex-col rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:bg-[var(--surface-raised)] sm:px-5"
          : "px-4 py-4 transition-colors hover:bg-[var(--surface-raised)] sm:px-5"
      }
    >
      <div className={`flex flex-wrap items-start justify-between gap-4 ${isCard ? "flex-1" : ""}`}>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-medium leading-6 text-foreground">
            {item.title}
          </h3>
          {category ? (
            <Badge
              variant="outline"
              className="mt-2 border-[var(--border-subtle)] text-muted-foreground"
            >
              {category}
            </Badge>
          ) : null}
          {item.summary ? (
            <p className="mt-2 line-clamp-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {item.summary}
            </p>
          ) : null}
          {["skills", "competencies"].includes(sectionKey) ? (
            <SkillLevel item={item} />
          ) : null}
        </div>
        <Badge
          variant="outline"
          className={`capitalize ${statusClass(item.status)}`}
        >
          {item.status}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
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
  const levelLabel = level === "not_assessed" ? "Not assessed" : level;
  return (
    <div className="mt-4 max-w-md">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Your level</span>
        <span className="font-medium capitalize text-foreground">
          {levelLabel}
        </span>
      </div>
      <Progress
        value={percentage}
        aria-label={`Proficiency: ${levelLabel}`}
        className="mt-2 gap-0 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-[var(--surface-sunken)]"
      />
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
          <h4 className="font-heading font-semibold text-foreground">
            Edit {item.title}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Changes update the confirmed Master Profile used for job analysis.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]"
        >
          Unsaved
        </Badge>
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
        <Alert
          variant="destructive"
          className="mt-4 border-[var(--danger-border)] bg-[var(--danger-background)]"
        >
          <AlertDescription className="text-[var(--danger)]">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => {
            setError(null);
            onCancel();
          }}
        >
          Cancel
        </Button>
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
    <span className="mb-2 block text-sm font-medium text-foreground">
      {children}
    </span>
  );
}

const fieldClass =
  "min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35";

const filterControlClass =
  "min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35";

function statusClass(status: string) {
  const normalised = status.trim().toLowerCase();
  if (normalised === "confirmed" || normalised === "active") {
    return "border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]";
  }
  if (
    normalised === "proposed" ||
    normalised === "candidate" ||
    normalised === "pending"
  ) {
    return "border-[var(--warning-border)] bg-[var(--warning-background)] text-[var(--warning)]";
  }
  if (normalised === "rejected" || normalised === "failed") {
    return "border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]";
  }
  return "border-border bg-muted text-muted-foreground";
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-border px-5 py-4 last:border-b-0 sm:border-b-0">
      <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
