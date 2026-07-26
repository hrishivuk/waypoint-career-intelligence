export const cvSectionTypes = [
  "header",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "other",
] as const;

export type CvSectionType = (typeof cvSectionTypes)[number];

export interface ParsedCvSection {
  sectionType: CvSectionType;
  heading: string | null;
  content: string;
  position: number;
  startOffset: number;
  endOffset: number;
}

export interface ParsedCvClaim {
  sectionPosition: number;
  claimType:
    | "contact"
    | "summary"
    | "skill"
    | "experience"
    | "education"
    | "project"
    | "certification"
    | "other";
  label: string;
  value: string;
  sourceText: string;
  startOffset: number;
  endOffset: number;
}

export interface CvSnapshot {
  id: string;
  displayName: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  intendedRoles: string[];
  notes: string | null;
  processingStatus: "processing" | "ready" | "failed";
  processingError: string | null;
  pageCount: number | null;
  parserVersion: string;
  createdAt: string;
  sections: Array<{
    id: string;
    sectionType: CvSectionType;
    heading: string | null;
    content: string;
    position: number;
  }>;
  claims: Array<{
    id: string;
    claimType: ParsedCvClaim["claimType"];
    label: string;
    value: string;
    sourceText: string;
  }>;
}

