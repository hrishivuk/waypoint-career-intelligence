import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { OpenAiConfig } from "./config";
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
  buildUntrustedDocumentInput,
  CV_FACT_EXTRACTION_PROMPT_VERSION,
  CAREER_NARRATIVE_EXTRACTION_PROMPT_VERSION,
  JOB_DESCRIPTION_PARSING_PROMPT_VERSION,
  SEMANTIC_REQUIREMENT_MATCHING_PROMPT_VERSION,
} from "./prompts";
import {
  CvFactExtractionSchema,
  CareerNarrativeExtractionSchema,
  JobDescriptionParsingSchema,
  SemanticRequirementMatchingSchema,
  type CvFactExtraction,
  type CareerNarrativeExtraction,
  type JobDescriptionParsing,
  type SemanticRequirementMatching,
} from "./schemas";

export class AiResponseError extends Error {
  constructor(
    message: string,
    readonly responseId: string,
  ) {
    super(message);
    this.name = "AiResponseError";
  }
}

export class OpenAiCareerAiGateway implements CareerAiGateway {
  private readonly client: OpenAI;

  constructor(
    private readonly config: OpenAiConfig,
    client?: OpenAI,
  ) {
    this.client = client ?? new OpenAI({ apiKey: config.apiKey });
  }

  async extractCareerNarrative(
    input: CareerNarrativeInput,
  ): Promise<AiExtractionResult<CareerNarrativeExtraction>> {
    const model = this.config.models["job-requirement-matching"];
    const response = await this.client.responses.parse({
      model,
      instructions: buildCareerNarrativeExtractionInstructions(),
      input: JSON.stringify({
        documentType: "career_narrative",
        trustBoundary: "untrusted_document_data",
        sourceBlocks: input.blocks,
        existingProfileRecords: input.existingProfileRecords,
      }),
      text: {
        format: zodTextFormat(
          CareerNarrativeExtractionSchema,
          "career_narrative_extraction",
        ),
      },
      store: false,
    });
    if (response.output_parsed === null) {
      throw new AiResponseError(
        refusalMessage(response.output) ??
          "The AI response did not contain a valid career narrative.",
        response.id,
      );
    }
    return {
      data: response.output_parsed,
      responseId: response.id,
      model,
      promptVersion: CAREER_NARRATIVE_EXTRACTION_PROMPT_VERSION,
    };
  }

  async extractCvFacts(
    cvText: string,
  ): Promise<AiExtractionResult<CvFactExtraction>> {
    const model = this.config.models["cv-fact-extraction"];
    const response = await this.client.responses.parse({
      model,
      instructions: buildCvFactExtractionInstructions(),
      input: buildUntrustedDocumentInput("candidate_cv", cvText),
      text: {
        format: zodTextFormat(CvFactExtractionSchema, "cv_fact_extraction"),
      },
      store: false,
    });

    if (response.output_parsed === null) {
      throw new AiResponseError(
        refusalMessage(response.output) ??
          "The AI response did not contain a valid CV extraction.",
        response.id,
      );
    }

    return {
      data: response.output_parsed,
      responseId: response.id,
      model,
      promptVersion: CV_FACT_EXTRACTION_PROMPT_VERSION,
    };
  }

  async parseJobDescription(
    jobDescriptionText: string,
  ): Promise<AiExtractionResult<JobDescriptionParsing>> {
    const model = this.config.models["job-description-parsing"];
    const response = await this.client.responses.parse({
      model,
      instructions: buildJobDescriptionParsingInstructions(),
      input: buildUntrustedDocumentInput(
        "job_description",
        jobDescriptionText,
      ),
      text: {
        format: zodTextFormat(
          JobDescriptionParsingSchema,
          "job_description_parsing",
        ),
      },
      store: false,
    });

    if (response.output_parsed === null) {
      throw new AiResponseError(
        refusalMessage(response.output) ??
          "The AI response did not contain a valid job-description parse.",
        response.id,
      );
    }

    return {
      data: response.output_parsed,
      responseId: response.id,
      model,
      promptVersion: JOB_DESCRIPTION_PARSING_PROMPT_VERSION,
    };
  }

  async matchJobRequirements(
    input: SemanticRequirementMatchingInput,
  ): Promise<AiExtractionResult<SemanticRequirementMatching>> {
    const model = this.config.models["job-requirement-matching"];
    const response = await this.client.responses.parse({
      model,
      instructions: buildSemanticRequirementMatchingInstructions(),
      input: JSON.stringify({
        trustBoundary: "untrusted_career_matching_data",
        ...input,
      }),
      text: {
        format: zodTextFormat(
          SemanticRequirementMatchingSchema,
          "semantic_requirement_matching",
        ),
      },
      store: false,
    });
    if (response.output_parsed === null) {
      throw new AiResponseError(
        refusalMessage(response.output) ??
          "The AI response did not contain valid semantic matches.",
        response.id,
      );
    }
    return {
      data: response.output_parsed,
      responseId: response.id,
      model,
      promptVersion: SEMANTIC_REQUIREMENT_MATCHING_PROMPT_VERSION,
    };
  }
}

function refusalMessage(output: unknown[]): string | null {
  for (const item of output) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("type" in item) ||
      item.type !== "message" ||
      !("content" in item) ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const content of item.content) {
      if (
        typeof content === "object" &&
        content !== null &&
        "type" in content &&
        content.type === "refusal" &&
        "refusal" in content &&
        typeof content.refusal === "string"
      ) {
        return content.refusal;
      }
    }
  }

  return null;
}
