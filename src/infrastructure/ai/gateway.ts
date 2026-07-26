import type {
  CvFactExtraction,
  CareerNarrativeExtraction,
  JobDescriptionParsing,
  SemanticRequirementMatching,
} from "./schemas";

export interface AiExtractionResult<T> {
  data: T;
  responseId: string;
  model: string;
  promptVersion: string;
}

export interface CareerAiGateway {
  extractCareerNarrative(
    input: CareerNarrativeInput,
  ): Promise<AiExtractionResult<CareerNarrativeExtraction>>;
  extractCvFacts(cvText: string): Promise<AiExtractionResult<CvFactExtraction>>;
  parseJobDescription(
    jobDescriptionText: string,
  ): Promise<AiExtractionResult<JobDescriptionParsing>>;
  matchJobRequirements(
    input: SemanticRequirementMatchingInput,
  ): Promise<AiExtractionResult<SemanticRequirementMatching>>;
}

export interface CareerNarrativeInput {
  blocks: Array<{ id: string; text: string }>;
  existingProfileRecords: Array<{
    id: string;
    recordType: string;
    title: string;
    statement: string;
    structuredData: Record<string, unknown>;
  }>;
}

export interface SemanticRequirementMatchingInput {
  requirements: Array<{
    id: string;
    text: string;
    kind: string;
    required: boolean;
  }>;
  knowledge: Array<{
    id: string;
    type: "skill" | "competency" | "evidence";
    name: string;
    level: string | null;
    aliases: string[];
    summary: string | null;
  }>;
}
