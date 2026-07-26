import type {
  CvSectionType,
  ParsedCvClaim,
  ParsedCvSection,
} from "@/domain/cv/cv-document";

const headingTypes: Array<[RegExp, CvSectionType]> = [
  [/^(summary|profile|professional summary|personal profile|objective)$/i, "summary"],
  [/^(experience|work experience|professional experience|employment|employment history|work history)$/i, "experience"],
  [/^(education|education and qualifications|qualifications|academic background)$/i, "education"],
  [/^(skills|technical skills|core skills|key skills|technologies|tech stack)$/i, "skills"],
  [/^(projects|selected projects|personal projects|key projects)$/i, "projects"],
  [/^(certifications|certificates|training)$/i, "certifications"],
];

function classifyHeading(line: string): CvSectionType | null {
  const cleaned = line.trim().replace(/:$/, "");
  if (cleaned.length > 45) return null;
  return headingTypes.find(([pattern]) => pattern.test(cleaned))?.[1] ?? null;
}

function claimTypeFor(sectionType: CvSectionType): ParsedCvClaim["claimType"] {
  const mapping: Record<CvSectionType, ParsedCvClaim["claimType"]> = {
    header: "contact",
    summary: "summary",
    experience: "experience",
    education: "education",
    skills: "skill",
    projects: "project",
    certifications: "certification",
    other: "other",
  };
  return mapping[sectionType];
}

export function parseCvDeterministically(input: string): {
  text: string;
  sections: ParsedCvSection[];
  claims: ParsedCvClaim[];
} {
  const text = separateInlineHeadings(
    input.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim(),
  );
  const lines = [...text.matchAll(/[^\n]+/g)].map((match) => ({
    text: match[0].trim(),
    start: match.index,
    end: match.index + match[0].length,
  })).filter((line) => line.text);

  const boundaries: Array<{ index: number; type: CvSectionType; heading: string | null }> = [
    { index: 0, type: "header", heading: null },
  ];
  for (let index = 0; index < lines.length; index++) {
    const type = classifyHeading(lines[index].text);
    if (type) boundaries.push({ index, type, heading: lines[index].text.replace(/:$/, "") });
  }

  const unique = boundaries.filter((boundary, index) =>
    index === 0 || boundary.index !== boundaries[index - 1].index,
  );
  const sections: ParsedCvSection[] = [];
  for (let position = 0; position < unique.length; position++) {
    const boundary = unique[position];
    const next = unique[position + 1];
    const firstContentLine = boundary.heading ? boundary.index + 1 : boundary.index;
    const sectionLines = lines.slice(firstContentLine, next?.index);
    if (sectionLines.length === 0) continue;
    const startOffset = sectionLines[0].start;
    const endOffset = sectionLines.at(-1)!.end;
    sections.push({
      sectionType: boundary.type,
      heading: boundary.heading,
      content: text.slice(startOffset, endOffset).trim(),
      position: sections.length,
      startOffset,
      endOffset,
    });
  }

  if (sections.length === 0 && text) {
    sections.push({
      sectionType: "other",
      heading: null,
      content: text,
      position: 0,
      startOffset: 0,
      endOffset: text.length,
    });
  }

  const claims: ParsedCvClaim[] = [];
  for (const section of sections) {
    const pieces = section.sectionType === "skills"
      ? section.content.split(/\n|,|•|\||;/)
      : section.content.split(/\n|•/);
    for (const rawPiece of pieces) {
      const value = rawPiece.replace(/^[-–—]\s*/, "").trim();
      if (value.length < 2) continue;
      const localOffset = text.indexOf(value, section.startOffset);
      if (localOffset < 0 || localOffset >= section.endOffset) continue;
      claims.push({
        sectionPosition: section.position,
        claimType: claimTypeFor(section.sectionType),
        label: section.heading ?? (section.sectionType === "header" ? "CV header" : section.sectionType),
        value,
        sourceText: value,
        startOffset: localOffset,
        endOffset: localOffset + value.length,
      });
    }
  }

  return { text, sections, claims };
}

function separateInlineHeadings(text: string) {
  const headingNames = [
    "PROFESSIONAL SUMMARY",
    "PERSONAL PROFILE",
    "WORK EXPERIENCE",
    "PROFESSIONAL EXPERIENCE",
    "EMPLOYMENT HISTORY",
    "TECHNICAL SKILLS",
    "CORE SKILLS",
    "SELECTED PROJECTS",
    "CERTIFICATIONS",
    "EXPERIENCE",
    "EDUCATION",
    "PROJECTS",
    "SUMMARY",
    "PROFILE",
    "SKILLS",
  ];
  let result = text;
  for (const heading of headingNames) {
    result = result.replace(
      new RegExp(`(^|\\s)${heading}(?=\\s+)`, "g"),
      (_match, prefix: string) => `${prefix === "" || prefix === "\n" ? prefix : "\n"}${heading}\n`,
    );
  }
  return result;
}
