import { FixedPrototypeIdentityProvider } from "@/infrastructure/auth/fixed-prototype-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

const sectionTables = {
  "stable-facts": "career_profile_facts",
  skills: "skills",
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ section: string; id: string }> },
) {
  try {
    const actor = await new FixedPrototypeIdentityProvider().getActor();
    const { section, id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const client = getSupabaseServerClient();
    const { data: masterRecord, error: masterLoadError } = await client
      .from("master_profile_records")
      .select("*")
      .eq("id", id)
      .eq("user_id", actor.userId)
      .eq("status", "confirmed")
      .maybeSingle();
    if (masterLoadError) throw masterLoadError;
    if (masterRecord) {
      const title = requiredText(body.title, "Title");
      const statement = requiredText(body.statement, "Description");
      const currentStructured =
        masterRecord.structured_data &&
        typeof masterRecord.structured_data === "object" &&
        !Array.isArray(masterRecord.structured_data)
          ? masterRecord.structured_data
          : {};
      const structuredData = {
        ...currentStructured,
        tags: commaList(body.tags),
        ...(masterRecord.record_type === "skill"
          ? { proficiency: masterProfileLevel(body.capabilityLevel) }
          : {}),
      };
      const { data, error } = await client
        .from("master_profile_records")
        .update({
          title,
          statement,
          structured_data: structuredData,
          canonical_key: `${slug(String(masterRecord.record_type))}-${slug(title)}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", actor.userId)
        .select("*")
        .single();
      if (error) throw error;
      return Response.json({ record: data });
    }
    if (!(section in sectionTables)) {
      return Response.json(
        { error: { message: "This knowledge type is not editable yet." } },
        { status: 400 },
      );
    }
    const table = sectionTables[section as keyof typeof sectionTables];
    const { data: current, error: loadError } = await client
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!current) {
      return Response.json(
        { error: { message: "Knowledge record not found." } },
        { status: 404 },
      );
    }

    const update =
      section === "stable-facts"
        ? stableFactUpdate(body, current as Record<string, unknown>)
        : skillUpdate(body);
    const { data, error } = await client
      .from(table)
      .update(update)
      .eq("id", id)
      .eq("user_id", actor.userId)
      .select("*")
      .single();
    if (error) throw error;
    if (section === "skills") {
      await updateCapabilityLevel(
        actor.userId,
        id,
        body.capabilityLevel,
      );
    }
    return Response.json({ record: data });
  } catch (error) {
    console.error("Knowledge edit failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: { message: safeEditMessage(error) } },
      { status: 500 },
    );
  }
}

function masterProfileLevel(value: unknown) {
  const allowed = ["learning", "basic", "working", "strong", "expert"];
  if (value === "not_assessed" || value === null || value === "") return null;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error("The skill level is invalid.");
  }
  return value;
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 150) || "record"
  );
}

async function updateCapabilityLevel(
  userId: string,
  skillId: string,
  value: unknown,
) {
  const allowed = ["learning", "basic", "working", "strong", "expert"];
  const level = typeof value === "string" ? value : "not_assessed";
  if (level !== "not_assessed" && !allowed.includes(level)) {
    throw new Error("The skill level is invalid.");
  }
  const client = getSupabaseServerClient();
  const { data: existing, error: loadError } = await client
    .from("capability_assessments")
    .select("id")
    .eq("user_id", userId)
    .eq("skill_id", skillId)
    .eq("status", "confirmed")
    .maybeSingle();
  if (loadError) throw loadError;
  const now = new Date().toISOString();
  if (level === "not_assessed") {
    if (existing) {
      const { error } = await client
        .from("capability_assessments")
        .update({ status: "superseded", updated_at: now })
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (error) throw error;
    }
    return;
  }
  if (existing) {
    const { error } = await client
      .from("capability_assessments")
      .update({
        current_level: level,
        confidence: 1,
        assessed_at: now,
        last_confirmed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await client.from("capability_assessments").insert({
    user_id: userId,
    skill_id: skillId,
    current_level: level,
    assessed_at: now,
    status: "confirmed",
    confidence: 1,
    source_type: "user_assessment",
    source_ref: {
      entered_by: "user",
      workflow: "knowledge_library_editor",
    },
    last_confirmed_at: now,
    tags: ["user-assessed"],
  });
  if (error) throw error;
}

function stableFactUpdate(
  body: Record<string, unknown>,
  current: Record<string, unknown>,
) {
  const statement = requiredText(body.statement, "Statement");
  const value =
    typeof current.value === "object" &&
    current.value !== null &&
    !Array.isArray(current.value)
      ? { ...(current.value as Record<string, unknown>), statement }
      : { statement, evidence_refs: [] };
  return {
    value,
    confidence: confidence(body.confidence),
    source_valid_from: precisionDate(body.validFrom),
    source_valid_until: precisionDate(body.validUntil),
    source_last_confirmed: precisionDate(body.lastConfirmed),
    source_review_after: precisionDate(body.reviewAfter),
    criticality: enumValue(body.criticality, [
      "normal",
      "important",
      "critical",
    ]),
    stale_behavior: enumValue(body.staleBehavior, [
      "warn",
      "reduce_confidence",
      "require_review",
      "force_investigate",
    ]),
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function skillUpdate(body: Record<string, unknown>) {
  return {
    name: requiredText(body.name, "Skill name"),
    category: optionalText(body.category),
    description: optionalText(body.description),
    aliases: commaList(body.aliases),
    confidence: confidence(body.confidence),
    source_valid_from: precisionDate(body.validFrom),
    source_valid_until: precisionDate(body.validUntil),
    source_last_confirmed: precisionDate(body.lastConfirmed),
    source_review_after: precisionDate(body.reviewAfter),
    criticality: enumValue(body.criticality, [
      "normal",
      "important",
      "critical",
    ]),
    stale_behavior: enumValue(body.staleBehavior, [
      "warn",
      "reduce_confidence",
      "require_review",
      "force_investigate",
    ]),
    last_confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function precisionDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Date must be text.");
  const trimmed = value.trim();
  const precision = /^\d{4}$/.test(trimmed)
    ? "year"
    : /^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)
      ? "month"
      : /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(trimmed)
        ? "day"
        : null;
  if (!precision) {
    throw new Error("Dates must use YYYY, YYYY-MM, or YYYY-MM-DD.");
  }
  if (
    precision === "day" &&
    Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))
  ) {
    throw new Error("A date is not valid.");
  }
  return { value: trimmed, precision };
}

function confidence(value: unknown) {
  const percentage = Number(value);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error("Confidence must be between 0 and 100.");
  }
  return percentage / 100;
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function commaList(value: unknown) {
  return typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

function enumValue(value: unknown, allowed: string[]) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error("An edited option is invalid.");
  }
  return value;
}

function safeEditMessage(error: unknown) {
  if (
    error instanceof Error &&
    [
      "required",
      "between",
      "must use",
      "not valid",
      "invalid",
    ].some((text) => error.message.includes(text))
  ) {
    return error.message;
  }
  return "The knowledge changes could not be saved.";
}
