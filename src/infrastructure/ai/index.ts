export {
  DEFAULT_OPENAI_MODEL,
  loadOpenAiConfig,
  type AiTask,
  type OpenAiConfig,
} from "./config";
export {
  type AiExtractionResult,
  type CareerAiGateway,
} from "./gateway";
export {
  AiResponseError,
  OpenAiCareerAiGateway,
} from "./openai-career-ai-gateway";
export {
  createCareerAiGateway,
  configuredAiProvider,
  type AiProvider,
} from "./create-career-ai-gateway";
export {
  GroqCareerAiGateway,
  type GroqConfig,
} from "./groq-career-ai-gateway";
export {
  buildCvFactExtractionInstructions,
  buildCareerNarrativeExtractionInstructions,
  buildJobDescriptionParsingInstructions,
  buildSemanticRequirementMatchingInstructions,
  buildUntrustedDocumentInput,
  CV_FACT_EXTRACTION_PROMPT_VERSION,
  JOB_DESCRIPTION_PARSING_PROMPT_VERSION,
  SEMANTIC_REQUIREMENT_MATCHING_PROMPT_VERSION,
  CAREER_NARRATIVE_EXTRACTION_PROMPT_VERSION,
} from "./prompts";
export {
  ConfidenceSchema,
  CareerNarrativeExtractionSchema,
  CvFactExtractionSchema,
  JobDescriptionParsingSchema,
  SemanticRequirementMatchingSchema,
  SourceSpanSchema,
  type CvFactExtraction,
  type CareerNarrativeExtraction,
  type JobDescriptionParsing,
  type SemanticRequirementMatching,
} from "./schemas";
