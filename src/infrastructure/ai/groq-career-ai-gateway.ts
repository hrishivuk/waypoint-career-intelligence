import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type {
  AiExtractionResult,
  CareerAiGateway,
  CareerNarrativeInput,
  SemanticRequirementMatchingInput,
} from "./gateway";
import {
  buildCvFactExtractionInstructions,
  buildCareerNarrativeExtractionInstructions,
  buildJobDescriptionParsingInstructions,
  buildSemanticRequirementMatchingInstructions,
  CV_FACT_EXTRACTION_PROMPT_VERSION,
  CAREER_NARRATIVE_EXTRACTION_PROMPT_VERSION,
  JOB_DESCRIPTION_PARSING_PROMPT_VERSION,
  SEMANTIC_REQUIREMENT_MATCHING_PROMPT_VERSION,
} from "./prompts";
import {
  ConfidenceSchema,
  CvFactExtractionSchema,
  CareerNarrativeExtractionSchema,
  JobDescriptionParsingSchema,
  type CvFactExtraction,
  type CareerNarrativeExtraction,
  type JobDescriptionParsing,
  type SemanticRequirementMatching,
} from "./schemas";
import {
  createDocumentTextBlocks,
  type DocumentTextBlock,
} from "@/infrastructure/documents";

export interface GroqConfig {
  apiKey: string;
  models: {
    "cv-fact-extraction": string;
    "job-description-parsing": string;
    "job-requirement-matching": string;
  };
}

export class GroqCareerAiGateway implements CareerAiGateway {
  private readonly client: OpenAI;

  constructor(
    private readonly config: GroqConfig,
    client?: OpenAI,
  ) {
    this.client =
      client ??
      new OpenAI({
        apiKey: config.apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
  }

  async extractCareerNarrative(
    input: CareerNarrativeInput,
  ): Promise<AiExtractionResult<CareerNarrativeExtraction>> {
    const model = this.config.models["job-requirement-matching"];
    try {
      const result = await this.parseStructured<
        z.infer<typeof GroqCompactCareerNarrativeSchema>
      >({
        model,
        instructions: `${buildCareerNarrativeExtractionInstructions()}

Use the compact output contract. The application performs reconciliation, so
do not decide whether records are new or updates. Every field is required; use
null or an empty array when it does not apply.`,
        input: JSON.stringify({
          documentType: "career_narrative",
          trustBoundary: "untrusted_document_data",
          sourceBlocks: input.blocks,
          existingProfileRecords: input.existingProfileRecords,
        }),
        schema: GroqCompactCareerNarrativeSchema,
        schemaName: "compact_career_narrative_extraction",
        promptVersion: CAREER_NARRATIVE_EXTRACTION_PROMPT_VERSION,
        maxCompletionTokens: 2600,
      });
      return { ...result, data: expandCompactCareerNarrative(result.data) };
    } catch (error) {
      const recovered = recoverCompactCareerNarrativeGeneration(error);
      if (!recovered) throw error;
      return {
        data: expandCompactCareerNarrative(recovered),
        responseId: groqRequestId(error) ?? "recovered-generation",
        model,
        promptVersion: `${CAREER_NARRATIVE_EXTRACTION_PROMPT_VERSION}-recovered`,
      };
    }
  }

  async extractCvFacts(
    cvText: string,
  ): Promise<AiExtractionResult<CvFactExtraction>> {
    const model = this.config.models["cv-fact-extraction"];
    const blocks = createDocumentTextBlocks(cvText);
    const chunks = chunkBlocks(blocks, 10_000);
    const extracted: FlatCvExtraction[] = [];
    const responseIds: string[] = [];
    const failures: string[] = [];

    for (const chunk of chunks) {
      try {
      const completion = await this.requestWithRetry(() =>
        this.client.chat.completions.parse({
        model,
        messages: [
          {
            role: "system",
            content: `${buildCvFactExtractionInstructions("block_ids")}

Use the flat output contract. Return one item per experience, education entry,
skill, certification or project. Every field in the schema is required; use
null or an empty array when a field does not apply. For every item, return
exactly one supporting blockId from sourceBlocks. Never reproduce a quote.

Field mapping:
- experience: name=employer, title=job title, description=one concise
  responsibility or achievement explicitly stated in the cited block
- education: name=institution, title=qualification
- skill: name=canonical skill name, category=best category
- certification: name=certificate, organization=issuer
- project: name=project name, description=short factual description

Do not create an item unless the cited block itself supports its identifying
name. Never infer proficiency, duration, achievements or technologies that are
not explicitly present.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              documentType: "candidate_cv",
              trustBoundary: "untrusted_document_data",
              sourceBlocks: chunk.map(({ id, text }) => ({ id, text })),
            }),
          },
        ],
        response_format: zodResponseFormat(
          GroqFlatCvExtractionSchema,
          "flat_cv_extraction",
        ),
        temperature: 0,
          store: false,
        }),
      );
      const message = completion.choices[0]?.message;
      if (!message?.parsed) {
        throw new Error(
          message?.refusal || "Groq did not return valid CV extraction.",
        );
      }
        extracted.push(message.parsed);
        responseIds.push(completion.id);
      } catch (error) {
        failures.push(
          error instanceof Error ? error.message : "Unknown section failure",
        );
      }
    }
    if (!extracted.length) {
      throw new Error(
        `No CV section could be extracted.${failures[0] ? ` ${failures[0]}` : ""}`,
      );
    }
    const compact = expandFlatCvExtractions(extracted, failures.length);
    return {
      data: expandCompactCvExtraction(compact, blocks),
      responseId: responseIds.join(","),
      model,
      promptVersion: `${CV_FACT_EXTRACTION_PROMPT_VERSION}-groq-compact-1`,
    };
  }

  async parseJobDescription(
    jobDescriptionText: string,
  ): Promise<AiExtractionResult<JobDescriptionParsing>> {
    const model = this.config.models["job-description-parsing"];
    const blocks = createDocumentTextBlocks(jobDescriptionText);
    const completion = await this.requestWithRetry(() =>
      this.client.chat.completions.parse({
        model,
        messages: [
          {
            role: "system",
            content: `${buildJobDescriptionParsingInstructions("block_ids")}

Use the flat output contract. Return role details and atomic requirements
only. Cite exactly one supplied source block ID for every requirement. Never
reproduce source quotes or calculate offsets. Split combined requirements into
independently assessable requirements. Examples introduced by "such as" or
"for example" remain examples rather than separate mandatory requirements.
Return at most 18 requirements, prioritising eligibility, mandatory core,
important and explicitly preferred requirements over descriptive content.
Every schema field is required; use null when a role field, normalized value,
or minimum years is not stated.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              documentType: "job_description",
              trustBoundary: "untrusted_document_data",
              sourceBlocks: blocks.map(({ id, text }) => ({ id, text })),
            }),
          },
        ],
        response_format: zodResponseFormat(
          GroqFlatJobParsingSchema,
          "flat_job_parsing",
        ),
        temperature: 0,
        reasoning_effort: "low",
        max_completion_tokens: 2800,
        store: false,
      }),
    );
      const message = completion.choices[0]?.message;
      if (!message?.parsed) {
        throw new Error(
          message?.refusal || "Groq did not return valid job parsing.",
        );
      }
    const compact = expandFlatJobParsing(message.parsed);
    const responseId = completion.id;
    return {
      data: expandCompactJobParsing(compact, blocks),
      responseId,
      model,
      promptVersion: `${JOB_DESCRIPTION_PARSING_PROMPT_VERSION}-groq-compact-1`,
    };
  }

  async matchJobRequirements(
    input: SemanticRequirementMatchingInput,
  ): Promise<AiExtractionResult<SemanticRequirementMatching>> {
    const model = this.config.models["job-requirement-matching"];
    const result = await this.parseStructured<
      z.infer<typeof GroqFlatSemanticMatchingSchema>
    >({
        model,
        instructions: buildSemanticRequirementMatchingInstructions(),
        input: JSON.stringify({
          trustBoundary: "untrusted_career_matching_data",
          ...input,
        }),
        schema: GroqFlatSemanticMatchingSchema,
        schemaName: "flat_semantic_requirement_matching",
        promptVersion: SEMANTIC_REQUIREMENT_MATCHING_PROMPT_VERSION,
      });
    return {
      ...result,
      data: expandFlatSemanticMatching(result.data),
    };
  }

  private async parseStructured<T>(input: {
    model: string;
    instructions: string;
    input: string;
    schema: Parameters<typeof zodResponseFormat>[0];
    schemaName: string;
    promptVersion: string;
    maxCompletionTokens?: number;
  }): Promise<AiExtractionResult<T>> {
    if (input.input.length > 24_000) {
      throw new Error("AI capability input exceeded its safe token budget.");
    }
    const completion = await this.requestWithRetry(() =>
      this.client.chat.completions.parse({
      model: input.model,
      messages: [
        { role: "system", content: input.instructions },
        { role: "user", content: input.input },
      ],
      response_format: zodResponseFormat(input.schema, input.schemaName),
      temperature: 0,
      reasoning_effort: "low",
      max_completion_tokens: input.maxCompletionTokens ?? 1400,
        store: false,
      }),
    );
    const message = completion.choices[0]?.message;
    if (!message?.parsed) {
      throw new Error(
        message?.refusal || "Groq did not return a valid structured result.",
      );
    }
    return {
      data: message.parsed as T,
      responseId: completion.id,
      model: input.model,
      promptVersion: input.promptVersion,
    };
  }

  private async requestWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === 1 || !isTransientGroqError(error)) throw error;
        await wait(retryDelayMilliseconds(error));
      }
    }
    throw lastError;
  }
}

const GroqCompactCareerNarrativeSchema = z.object({
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
      proficiencyBasis: z.string().nullable(),
      tags: z.array(z.string()),
      blockId: z.string(),
      confidence: ConfidenceSchema,
    }),
  ),
  processedBlockIds: z.array(z.string()),
  noClaimBlockIds: z.array(z.string()),
  warnings: z.array(z.string()),
});

function isTransientGroqError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { status?: unknown; code?: unknown };
  const status = Number(candidate.status);
  return (
    status === 429 ||
    status >= 500 ||
    (status === 400 && candidate.code === "json_validate_failed")
  );
}

function retryDelayMilliseconds(error: unknown) {
  if (typeof error !== "object" || error === null) return 1000;
  const headers = (error as { headers?: Headers }).headers;
  const retryAfter = Number(headers?.get("retry-after"));
  return Number.isFinite(retryAfter)
    ? Math.min(60000, Math.max(500, retryAfter * 1000))
    : 1000;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

interface CompactBlockEvidence {
  blockId: string;
  confidence: number;
}

interface CompactDates {
  start: string | null;
  end: string | null;
  isCurrent: boolean;
}

const GroqFlatCvExtractionSchema = z.object({
  items: z.array(
    z.object({
      kind: z.enum([
        "experience",
        "education",
        "skill",
        "certification",
        "project",
      ]),
      name: z.string(),
      title: z.string().nullable(),
      organization: z.string().nullable(),
      location: z.string().nullable(),
      field: z.string().nullable(),
      category: z
        .enum([
          "technical",
          "domain",
          "tool",
          "language",
          "interpersonal",
          "other",
        ])
        .nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
      description: z.string().nullable(),
      skills: z.array(z.string()),
      blockId: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  notes: z.array(z.string()),
});

type FlatCvExtraction = z.infer<typeof GroqFlatCvExtractionSchema>;

interface CompactCvExtraction {
  experiences: Array<{
    employer: string;
    title: string;
    location: string | null;
    dates: CompactDates;
    description: string | null;
    skills: string[];
    evidence: CompactBlockEvidence;
  }>;
  education: Array<{
    institution: string;
    qualification: string;
    field: string | null;
    dates: CompactDates;
    evidence: CompactBlockEvidence;
  }>;
  skills: Array<{
    name: string;
    category:
      | "technical"
      | "domain"
      | "tool"
      | "language"
      | "interpersonal"
      | "other";
    evidence: CompactBlockEvidence;
  }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    date: string | null;
    evidence: CompactBlockEvidence;
  }>;
  projects: Array<{
    name: string;
    description: string;
    skills: string[];
    evidence: CompactBlockEvidence;
  }>;
  extractionNotes: string[];
}

function chunkBlocks(
  blocks: DocumentTextBlock[],
  maximumCharacters: number,
) {
  const chunks: DocumentTextBlock[][] = [];
  let current: DocumentTextBlock[] = [];
  let characters = 0;
  for (const block of blocks) {
    if (current.length && characters + block.text.length > maximumCharacters) {
      chunks.push(current);
      current = [];
      characters = 0;
    }
    current.push(block);
    characters += block.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function expandFlatCvExtractions(
  extractions: FlatCvExtraction[],
  failureCount: number,
): CompactCvExtraction {
  const items = extractions.flatMap((extraction) => extraction.items);
  const evidence = (item: FlatCvExtraction["items"][number]) => ({
    blockId: item.blockId,
    confidence: item.confidence,
  });
  return {
    experiences: items
      .filter((item) => item.kind === "experience")
      .map((item) => ({
        employer: item.name,
        title: item.title ?? "",
        location: item.location,
        dates: {
          start: item.startDate,
          end: item.endDate,
          isCurrent: item.isCurrent,
        },
        description: item.description,
        skills: item.skills,
        evidence: evidence(item),
      })),
    education: items
      .filter((item) => item.kind === "education")
      .map((item) => ({
        institution: item.name,
        qualification: item.title ?? "",
        field: item.field,
        dates: {
          start: item.startDate,
          end: item.endDate,
          isCurrent: item.isCurrent,
        },
        evidence: evidence(item),
      })),
    skills: items
      .filter((item) => item.kind === "skill")
      .map((item) => ({
        name: item.name,
        category: item.category ?? "other",
        evidence: evidence(item),
      })),
    certifications: items
      .filter((item) => item.kind === "certification")
      .map((item) => ({
        name: item.name,
        issuer: item.organization,
        date: item.startDate,
        evidence: evidence(item),
      })),
    projects: items
      .filter((item) => item.kind === "project")
      .map((item) => ({
        name: item.name,
        description: item.description ?? item.name,
        skills: item.skills,
        evidence: evidence(item),
      })),
    extractionNotes: [
      ...extractions.flatMap((item) => item.notes),
      ...(failureCount
        ? [`${failureCount} source section(s) could not be extracted.`]
        : []),
    ],
  };
}

const GroqFlatJobParsingSchema = z.object({
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
      blockId: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

type FlatJobParsing = z.infer<typeof GroqFlatJobParsingSchema>;

const GroqFlatSemanticMatchingSchema = z.object({
  matches: z.array(
    z.object({
      requirementId: z.string(),
      aspectText: z.string(),
      status: z.enum(["supported", "partial", "unsupported", "uncertain"]),
      recordId: z.string().nullable(),
      relation: z
        .enum([
          "direct",
          "version_variant",
          "parent_child",
          "transferable",
          "supporting_evidence",
        ])
        .nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

function expandFlatSemanticMatching(
  flat: z.infer<typeof GroqFlatSemanticMatchingSchema>,
): SemanticRequirementMatching {
  return {
    requirements: flat.matches.map((match) => ({
      requirementId: match.requirementId,
      aspects: [
        {
          text: match.aspectText,
          status: match.status,
          citations:
            match.recordId && match.relation
              ? [
                  {
                    recordId: match.recordId,
                    relation: match.relation,
                    confidence: match.confidence,
                  },
                ]
              : [],
        },
      ],
    })),
  };
}

function expandFlatJobParsing(flat: FlatJobParsing): CompactJobParsing {
  return {
    role: {
      title: flat.title,
      company: flat.company,
      location: flat.location,
      workArrangement: flat.workArrangement,
      employmentType: flat.employmentType,
      seniority: flat.seniority,
    },
    requirements: flat.requirements.map((requirement) => ({
      text: requirement.text,
      kind: requirement.kind,
      priority: requirement.priority,
      normalizedValue: requirement.normalizedValue,
      minimumYears: requirement.minimumYears,
      evidence: {
        blockId: requirement.blockId,
        confidence: requirement.confidence,
      },
    })),
  };
}

interface CompactJobParsing {
  role: Pick<
    FlatJobParsing,
    | "title"
    | "company"
    | "location"
    | "workArrangement"
    | "employmentType"
    | "seniority"
  >;
  requirements: Array<
    Omit<FlatJobParsing["requirements"][number], "blockId" | "confidence"> & {
      evidence: CompactBlockEvidence;
    }
  >;
}

function expandCompactCvExtraction(
  compact: CompactCvExtraction,
  blocks: DocumentTextBlock[],
): CvFactExtraction {
  const evidence = (item: { blockId: string; confidence: number }) => ({
    source: sourceSpanForBlock(blocks, item.blockId),
    confidence: item.confidence,
  });
  return CvFactExtractionSchema.parse({
    candidate: {
      fullName: null,
      headline: null,
      location: null,
      email: null,
      phone: null,
      links: [],
    },
    summary: null,
    experiences: compact.experiences.map((item) => ({
      employer: item.employer,
      title: item.title,
      location: item.location,
      dates: item.dates,
      achievements: item.description
        ? [
            {
              text: item.description,
              skills: item.skills,
              metrics: [],
              evidence: evidence(item.evidence),
            },
          ]
        : [],
      evidence: evidence(item.evidence),
    })),
    education: compact.education.map((item) => ({
      ...item,
      evidence: evidence(item.evidence),
    })),
    skills: compact.skills.map((item) => ({
      ...item,
      evidence: evidence(item.evidence),
    })),
    certifications: compact.certifications.map((item) => ({
      ...item,
      evidence: evidence(item.evidence),
    })),
    projects: compact.projects.map((item) => ({
      ...item,
      evidence: evidence(item.evidence),
    })),
    extractionNotes: compact.extractionNotes,
  });
}

function sourceSpanForBlock(blocks: DocumentTextBlock[], blockId: string) {
  const block = blocks.find((candidate) => candidate.id === blockId);
  if (!block) {
    throw new Error("Groq cited a source block that was not supplied.");
  }
  return {
    quote: block.text,
    startCharacter: block.startCharacter,
    endCharacter: block.endCharacter,
  };
}

function expandCompactJobParsing(
  compact: CompactJobParsing,
  blocks: DocumentTextBlock[],
): JobDescriptionParsing {
  return JobDescriptionParsingSchema.parse({
    role: compact.role,
    requirements: compact.requirements.map((requirement) => ({
      ...requirement,
      evidence: {
        source: sourceSpanForBlock(blocks, requirement.evidence.blockId),
        confidence: requirement.evidence.confidence,
      },
    })),
    responsibilities: [],
    compensation: null,
    benefits: [],
    applicationInstructions: [],
    ambiguities: [],
    parsingNotes: [],
  });
}

function recoverCompactCareerNarrativeGeneration(
  error: unknown,
): z.infer<typeof GroqCompactCareerNarrativeSchema> | null {
  const failedGeneration = groqErrorDetails(error)?.failed_generation;
  if (typeof failedGeneration !== "string" || !failedGeneration.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(failedGeneration) as Record<string, unknown>;
    const recordBlockIds = Array.isArray(parsed.records)
      ? parsed.records
          .map((record) =>
            record && typeof record === "object"
              ? (record as Record<string, unknown>).blockId
              : null,
          )
          .filter((id): id is string => typeof id === "string")
      : [];
    const recovered = GroqCompactCareerNarrativeSchema.safeParse({
      ...parsed,
      processedBlockIds: Array.isArray(parsed.processedBlockIds)
        ? parsed.processedBlockIds
        : [...new Set(recordBlockIds)],
      noClaimBlockIds: Array.isArray(parsed.noClaimBlockIds)
        ? parsed.noClaimBlockIds
        : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    });
    return recovered.success ? recovered.data : null;
  } catch {
    return null;
  }
}

function expandCompactCareerNarrative(
  compact: z.infer<typeof GroqCompactCareerNarrativeSchema>,
): CareerNarrativeExtraction {
  return CareerNarrativeExtractionSchema.parse({
    records: compact.records.map((record) => ({
      ...record,
      organization: null,
      role: null,
      startDate: null,
      endDate: null,
      isCurrent: false,
      strength: null,
      reconciliation: "new",
      existingRecordId: null,
    })),
    processedBlockIds: compact.processedBlockIds,
    noClaimBlockIds: compact.noClaimBlockIds,
    warnings: compact.warnings,
  });
}

function groqRequestId(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const requestId = (error as { requestID?: unknown }).requestID;
  return typeof requestId === "string" ? requestId : null;
}

function groqErrorDetails(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object") return null;
  const details = (error as { error?: unknown }).error;
  return details && typeof details === "object"
    ? (details as Record<string, unknown>)
    : null;
}
