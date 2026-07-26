import "server-only";

import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

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

export async function loadApplicationKit(userId: string) {
  const client = getSupabaseServerClient();
  const existing = await client
    .from("application_kit_sections")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (existing.error) throw existing.error;
  if (!existing.data?.length) await seedApplicationKit(userId);

  const { data, error } = await client
    .from("application_kit_sections")
    .select("*, application_kit_items(*)")
    .eq("user_id", userId)
    .order("position");
  if (error) throw error;
  return ((data ?? []) as Row[]).map(serializeSection);
}

async function seedApplicationKit(userId: string) {
  const client = getSupabaseServerClient();
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
  const direction = statement("Product‑focused career direction");
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
        ["Frontend CV", String((cvs?.[0] as Row | undefined)?.display_name ?? ""), cvs?.length ? "cv" : "manual"],
        ["Product Design CV", "", "manual"],
        ["UX CV", "", "manual"],
        ["General CV", "", "manual"],
      ],
    },
    {
      sectionType: "static",
      title: "Career preferences",
      description: "Current preferences that can be updated whenever your search changes.",
      items: [
        ["Desired roles", desiredRoles, desiredRoles ? "profile" : "manual"],
        ["Alternative roles", "Frontend Engineer, Product Engineer, UX Engineer, Product Designer, UX Designer", desiredRoles ? "profile" : "manual"],
        ["Preferred industries", industries, industries ? "profile" : "manual"],
        ["Preferred company size", "Open to different company sizes; the quality of work, learning and ownership matter more.", "profile"],
        ["Work arrangement", workMode, workMode ? "profile" : "manual"],
        ["Preferred locations", preferredLocations, preferredLocations ? "profile" : "manual"],
        ["Salary expectation", "", "manual"],
        ["Employment type", "Full-time", "profile"],
        ["Earliest joining date", "", "manual"],
      ],
    },
    {
      sectionType: "reusable",
      title: "Reusable answers",
      description: "Natural first-person answers grounded in your confirmed Master Profile.",
      items: [
        ["Tell us about yourself", `I am a frontend engineer who naturally grew into product design. I enjoy understanding real user problems and building products that are useful, intuitive and maintainable. My experience combines frontend engineering, UX thinking and close collaboration with design and product teams.${direction ? " My long-term direction is to keep growing across engineering, UX and product thinking while contributing to meaningful products." : ""}`, "profile"],
        ["Why should we hire you?", "I bring a useful combination of frontend engineering, user-centred thinking and product awareness. I can take ownership of features, collaborate effectively with designers, developers and product teams, and make decisions by considering both the user experience and long-term maintainability. I am also curious, open to feedback and comfortable learning what I do not know.", "profile"],
        ["What are your main strengths?", "My main strengths are frontend engineering, product thinking, collaboration and curiosity. I like to understand the problem properly before choosing a solution, and I try to keep my work simple, maintainable and useful for the people using it. I also communicate openly, ask questions and take feedback positively.", "profile"],
        ["How do you work in a team?", "I work well both independently and as part of a cross-functional team. I enjoy discussing ideas, asking questions and understanding the reasoning behind decisions. I am comfortable taking ownership of my work while collaborating closely with designers, developers, product teams and other stakeholders.", "profile"],
        ["What are your career goals?", direction || "I want to continue growing across frontend engineering, UX and product thinking, and work on products from an early stage where I can contribute to both the direction and implementation.", "profile"],
        ["What kind of company are you looking for?", "I am looking for a product-focused team where I can keep learning, take ownership and work with people who care about user experience and good engineering practices. Company size is less important to me than meaningful work, mentorship, collaboration and long-term growth.", "profile"],
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
