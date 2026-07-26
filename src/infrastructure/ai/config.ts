import "server-only";

import { z } from "zod";

export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

const OpenAiEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().trim().min(1).default(DEFAULT_OPENAI_MODEL),
  OPENAI_CV_EXTRACTION_MODEL: z.string().trim().min(1).optional(),
  OPENAI_JD_PARSING_MODEL: z.string().trim().min(1).optional(),
  OPENAI_JOB_MATCHING_MODEL: z.string().trim().min(1).optional(),
});

export type AiTask =
  | "cv-fact-extraction"
  | "job-description-parsing"
  | "job-requirement-matching";

export interface OpenAiConfig {
  apiKey: string;
  models: Record<AiTask, string>;
}

export function loadOpenAiConfig(
  environment: NodeJS.ProcessEnv = process.env,
): OpenAiConfig {
  const parsed = OpenAiEnvironmentSchema.parse(environment);

  return {
    apiKey: parsed.OPENAI_API_KEY,
    models: {
      "cv-fact-extraction":
        parsed.OPENAI_CV_EXTRACTION_MODEL ?? parsed.OPENAI_MODEL,
      "job-description-parsing":
        parsed.OPENAI_JD_PARSING_MODEL ?? parsed.OPENAI_MODEL,
      "job-requirement-matching":
        parsed.OPENAI_JOB_MATCHING_MODEL ?? parsed.OPENAI_MODEL,
    },
  };
}
