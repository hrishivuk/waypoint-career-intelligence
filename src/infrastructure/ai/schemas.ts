import { z } from "zod";

export const ConfidenceSchema = z.number().min(0).max(1);

export const SourceSpanSchema = z
  .object({
    quote: z.string().min(1),
    startCharacter: z.number().int().nonnegative(),
    endCharacter: z.number().int().positive(),
  })
  .refine((span) => span.endCharacter > span.startCharacter, {
    message: "endCharacter must be greater than startCharacter",
  });

const DateRangeSchema = z.object({
  start: z.string().nullable(),
  end: z.string().nullable(),
  isCurrent: z.boolean(),
});

const EvidenceSchema = z.object({
  source: SourceSpanSchema,
  confidence: ConfidenceSchema,
});

export const CvFactExtractionSchema = z.object({
  candidate: z.object({
    fullName: z.string().nullable(),
    headline: z.string().nullable(),
    location: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    links: z.array(
      z.object({
        label: z.string(),
        url: z.string(),
        evidence: EvidenceSchema,
      }),
    ),
  }),
  summary: z
    .object({
      text: z.string(),
      evidence: EvidenceSchema,
    })
    .nullable(),
  experiences: z.array(
    z.object({
      employer: z.string(),
      title: z.string(),
      location: z.string().nullable(),
      dates: DateRangeSchema,
      achievements: z.array(
        z.object({
          text: z.string(),
          skills: z.array(z.string()),
          metrics: z.array(z.string()),
          evidence: EvidenceSchema,
        }),
      ),
      evidence: EvidenceSchema,
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      qualification: z.string(),
      field: z.string().nullable(),
      dates: DateRangeSchema,
      evidence: EvidenceSchema,
    }),
  ),
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.enum([
        "technical",
        "domain",
        "tool",
        "language",
        "interpersonal",
        "other",
      ]),
      evidence: EvidenceSchema,
    }),
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string().nullable(),
      date: z.string().nullable(),
      evidence: EvidenceSchema,
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      skills: z.array(z.string()),
      evidence: EvidenceSchema,
    }),
  ),
  extractionNotes: z.array(z.string()),
});

export type CvFactExtraction = z.infer<typeof CvFactExtractionSchema>;

export const JobDescriptionParsingSchema = z.object({
  role: z.object({
    title: z.string().nullable(),
    company: z.string().nullable(),
    location: z.string().nullable(),
    workArrangement: z.enum(["remote", "hybrid", "onsite", "unspecified"]),
    employmentType: z.enum([
      "permanent",
      "contract",
      "temporary",
      "internship",
      "unspecified",
    ]),
    seniority: z.enum([
      "entry",
      "mid",
      "senior",
      "lead",
      "manager",
      "executive",
      "unspecified",
    ]),
  }),
  requirements: z.array(
    z.object({
      text: z.string(),
      kind: z.enum([
        "skill",
        "experience",
        "education",
        "certification",
        "eligibility",
        "location",
        "language",
        "other",
      ]),
      priority: z.enum(["required", "preferred", "unclear"]),
      normalizedValue: z.string().nullable(),
      minimumYears: z.number().nonnegative().nullable(),
      evidence: EvidenceSchema,
    }),
  ),
  responsibilities: z.array(
    z.object({
      text: z.string(),
      evidence: EvidenceSchema,
    }),
  ),
  compensation: z
    .object({
      minimum: z.number().nonnegative().nullable(),
      maximum: z.number().nonnegative().nullable(),
      currency: z.string().nullable(),
      period: z.enum(["hour", "day", "month", "year", "unspecified"]),
      evidence: EvidenceSchema,
    })
    .nullable(),
  benefits: z.array(
    z.object({
      text: z.string(),
      evidence: EvidenceSchema,
    }),
  ),
  applicationInstructions: z.array(
    z.object({
      text: z.string(),
      evidence: EvidenceSchema,
    }),
  ),
  ambiguities: z.array(z.string()),
  parsingNotes: z.array(z.string()),
});

export type JobDescriptionParsing = z.infer<
  typeof JobDescriptionParsingSchema
>;

export const SemanticRequirementMatchingSchema = z.object({
  requirements: z.array(
    z.object({
      requirementId: z.string(),
      aspects: z.array(
        z.object({
          text: z.string(),
          status: z.enum(["supported", "partial", "unsupported", "uncertain"]),
          citations: z.array(
            z.object({
              recordId: z.string(),
              relation: z.enum([
                "direct",
                "version_variant",
                "parent_child",
                "transferable",
                "supporting_evidence",
              ]),
              confidence: ConfidenceSchema,
            }),
          ),
        }),
      ),
    }),
  ),
});

export type SemanticRequirementMatching = z.infer<
  typeof SemanticRequirementMatchingSchema
>;

export const CareerNarrativeExtractionSchema = z.object({
  records: z.array(
    z.object({
      recordType: z.enum([
        "stable_fact",
        "skill",
        "competency",
        "experience",
        "project",
        "education",
        "achievement",
        "career_direction",
        "preference",
        "eligibility",
        "decision_policy",
      ]),
      title: z.string(),
      statement: z.string(),
      proficiency: z
        .enum(["learning", "basic", "working", "strong", "expert"])
        .nullable(),
      organization: z.string().nullable(),
      role: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
      strength: z
        .enum(["required", "strongly_preferred", "preferred", "flexible"])
        .nullable(),
      tags: z.array(z.string()),
      blockId: z.string(),
      confidence: ConfidenceSchema,
      reconciliation: z.enum([
        "new",
        "update_existing",
        "already_known",
        "possible_conflict",
      ]),
      existingRecordId: z.string().nullable(),
      proficiencyBasis: z.string().nullable(),
    }),
  ),
  processedBlockIds: z.array(z.string()),
  noClaimBlockIds: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type CareerNarrativeExtraction = z.infer<
  typeof CareerNarrativeExtractionSchema
>;
