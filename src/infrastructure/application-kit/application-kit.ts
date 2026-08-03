import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

export interface ApplicationKitSection {
  id: string;
  sectionType: "static" | "reusable" | "generated";
  title: string;
  description: string | null;
  position: number;
  items: Array<{
    id: string;
    label: string;
    value: string;
    sourceKind: "profile" | "cv" | "manual" | "generated";
    position: number;
  }>;
}

export async function loadApplicationKit(client: SupabaseClient, userId: string) {
  const existing = await client
    .from("application_kit_sections")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (existing.error) throw existing.error;
  if (!existing.data?.length) await seedApplicationKit(client, userId);

  const { data, error } = await client
    .from("application_kit_sections")
    .select("*, application_kit_items(*)")
    .eq("user_id", userId)
    .order("position");
  if (error) throw error;
  return ((data ?? []) as Row[]).map(serializeSection);
}

async function seedApplicationKit(client: SupabaseClient, userId: string) {
  const [{ data: profile, error: profileError }, { data: cvs, error: cvError }] =
    await Promise.all([
      client
        .from("master_profile_records")
        .select("record_type,title,statement")
        .eq("user_id", userId)
        .eq("status", "confirmed"),
      client
        .from("cv_documents_v2")
        .select("display_name,extracted_text,processing_status")
        .eq("user_id", userId)
        .eq("processing_status", "ready")
        .order("created_at", { ascending: false }),
    ]);
  if (profileError) throw profileError;
  if (cvError) throw cvError;
  const records = (profile ?? []) as Row[];
  const cvText = String((cvs?.[0] as Row | undefined)?.extracted_text ?? "");
  const statement = (title: string) =>
    String(records.find((record) =>
      String(record.title).toLowerCase() === title.toLowerCase()
    )?.statement ?? "");
  const firstNonEmptyLine = cvText.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const fullName = /^[A-Za-z][A-Za-z .'-]{2,60}$/.test(firstNonEmptyLine)
    ? firstNonEmptyLine
    : "";
  const email = cvText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? "";
  const phone = cvText.match(/(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){8,13}/)?.[0]?.trim() ?? "";
  const links = extractLinks(cvText);
  const portfolio = links.find((link) => !/linkedin|github|gitlab|behance|dribbble|figma|medium/i.test(link)) ?? "";
  const linkedIn = links.find((link) => /linkedin/i.test(link)) ?? "";
  const github = links.find((link) => /github/i.test(link)) ?? "";
  const eligibility = statement("Location and work eligibility");
  const desiredRoles = statement("Desired roles");
  const industries = statement("Industry interests");
  const workMode = statement("Location and work mode preferences");
  const currentRole = statement("Current professional role");
  const currentLocation =
    eligibility.match(/based in ([^;]+?)(?:;|$)/i)?.[1]?.trim() ?? "";
  const visaStatus =
    eligibility.match(/holds? (?:an? )?([^;]+?)(?: granting| that grants|;|$)/i)?.[1]?.trim() ?? "";
  const preferredLocations =
    workMode.match(/(?:focus(?:ed)? on|locations?[:\s]+)(.+?)(?:\.|$)/i)?.[1]?.trim() ?? "";

  const sections = [
    {
      sectionType: "static",
      title: "Basic information",
      description: "Personal details commonly requested in application forms.",
      items: [
        ["Full name", fullName, cvText ? "cv" : "manual"],
        ["Preferred name", "", "manual"],
        ["Email", email, email ? "cv" : "manual"],
        ["Phone number", phone, phone ? "cv" : "manual"],
        ["Current location", currentLocation, currentLocation ? "profile" : "manual"],
        ["Nationality", "", "manual"],
        ["Work authorisation", eligibility, eligibility ? "profile" : "manual"],
        ["Visa status", visaStatus, visaStatus ? "profile" : "manual"],
        ["Current employment status", currentRole, currentRole ? "profile" : "manual"],
        ["Notice period", "", "manual"],
        ["Available start date", "", "manual"],
        ["Willing to relocate", "", "manual"],
        ["Willing to travel", "", "manual"],
        ["Driving licence", "", "manual"],
        ["Languages spoken", "", "manual"],
      ],
    },
    {
      sectionType: "static",
      title: "Professional links",
      description: "Links and documents you repeatedly paste into applications.",
      items: [
        ["Portfolio website", portfolio, portfolio ? "cv" : "manual"],
        ["LinkedIn", linkedIn, linkedIn ? "cv" : "manual"],
        ["GitHub", github, github ? "cv" : "manual"],
        ["GitLab", "", "manual"],
        ["Behance", "", "manual"],
        ["Dribbble", "", "manual"],
        ["Figma profile", "", "manual"],
        ["Medium", "", "manual"],
        ["Personal website", "", "manual"],
        ["Latest CV", String((cvs?.[0] as Row | undefined)?.display_name ?? ""), cvs?.length ? "cv" : "manual"],
      ],
    },
    {
      sectionType: "static",
      title: "Career preferences",
      description: "Current preferences that can be updated whenever your search changes.",
      items: [
        ["Desired roles", desiredRoles, desiredRoles ? "profile" : "manual"],
        ["Alternative roles", "", "manual"],
        ["Preferred industries", industries, industries ? "profile" : "manual"],
        ["Preferred company size", "", "manual"],
        ["Work arrangement", workMode, workMode ? "profile" : "manual"],
        ["Preferred locations", preferredLocations, preferredLocations ? "profile" : "manual"],
        ["Salary expectation", "", "manual"],
        ["Employment type", "", "manual"],
        ["Earliest joining date", "", "manual"],
      ],
    },
    {
      sectionType: "reusable",
      title: "Reusable answers",
      description: "Write and save truthful answers you can adapt for future applications.",
      items: [
        ["Tell us about yourself", "", "manual"],
        ["Why should we hire you?", "", "manual"],
        ["What are your main strengths?", "", "manual"],
        ["How do you work in a team?", "", "manual"],
        ["What are your career goals?", "", "manual"],
        ["What kind of company are you looking for?", "", "manual"],
        ["Are you legally authorised to work?", eligibility, eligibility ? "profile" : "manual"],
        ["What is your preferred work arrangement?", workMode, workMode ? "profile" : "manual"],
        ["How did you hear about us?", "", "manual"],
        ["Have you previously applied?", "", "manual"],
        ["Do you know anyone here?", "", "manual"],
      ],
    },
    {
      sectionType: "generated",
      title: "Job-specific answers",
      description: "These will be drafted from a selected job and confirmed Master Profile evidence.",
      items: [
        ["Why are you interested in this role?", "", "generated"],
        ["Why do you want to work for this company?", "", "generated"],
        ["How does your experience match this position?", "", "generated"],
        ["Write a short cover-note introduction", "", "generated"],
      ],
    },
  ] as const;

  for (let sectionPosition = 0; sectionPosition < sections.length; sectionPosition++) {
    const section = sections[sectionPosition];
    const { data: inserted, error } = await client
      .from("application_kit_sections")
      .upsert({
        user_id: userId,
        section_type: section.sectionType,
        title: section.title,
        description: section.description,
        position: sectionPosition,
      }, { onConflict: "user_id,position" })
      .select("id")
      .single();
    if (error) throw error;
    const { error: itemError } = await client.from("application_kit_items").upsert(
      section.items.map(([label, value, sourceKind], position) => ({
        user_id: userId,
        section_id: inserted.id,
        label,
        value,
        source_kind: sourceKind,
        position,
      })),
      { onConflict: "section_id,position" },
    );
    if (itemError) throw itemError;
  }
}

function extractLinks(text: string) {
  const matches = text.match(
    /(?:https?:\/\/|www\.)[^\s|]+|(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com)\/[^\s|]+|[a-z0-9-]+\.(?:com|dev|io|co|me|design)(?:\/[^\s|]*)?/gi,
  ) ?? [];
  return [...new Set(matches.map((value) => value.replace(/[),.;]+$/, "")))];
}

function serializeSection(row: Row): ApplicationKitSection {
  const items = ((row.application_kit_items as Row[] | null) ?? [])
    .sort((a, b) => Number(a.position) - Number(b.position));
  return {
    id: String(row.id),
    sectionType: row.section_type as ApplicationKitSection["sectionType"],
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    position: Number(row.position),
    items: items.map((item) => ({
      id: String(item.id),
      label: String(item.label),
      value: String(item.value ?? ""),
      sourceKind: item.source_kind as ApplicationKitSection["items"][number]["sourceKind"],
      position: Number(item.position),
    })),
  };
}
