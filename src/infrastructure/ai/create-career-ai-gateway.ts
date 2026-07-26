import "server-only";

import { z } from "zod";

import type { CareerAiGateway } from "./gateway";
import { GroqCareerAiGateway } from "./groq-career-ai-gateway";
import { loadOpenAiConfig } from "./config";
import { OpenAiCareerAiGateway } from "./openai-career-ai-gateway";

const providerSchema = z.enum(["groq", "openai"]).default("openai");

export type AiProvider = z.infer<typeof providerSchema>;

export function configuredAiProvider(
  environment: NodeJS.ProcessEnv = process.env,
): AiProvider {
  return providerSchema.parse(environment.AI_PROVIDER);
}

export function createCareerAiGateway(
  environment: NodeJS.ProcessEnv = process.env,
): CareerAiGateway {
  const provider = configuredAiProvider(environment);
  if (provider === "groq") {
    const apiKey = z
      .string()
      .trim()
      .min(1, "GROQ_API_KEY is required when AI_PROVIDER=groq")
      .parse(environment.GROQ_API_KEY);
    return new GroqCareerAiGateway({
      apiKey,
      models: configuredGroqModels(environment),
    });
  }
  return new OpenAiCareerAiGateway(loadOpenAiConfig(environment));
}

export function configuredGroqModels(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const fallback =
    environment.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  return {
    "cv-fact-extraction":
      environment.GROQ_CV_EXTRACTION_MODEL?.trim() || fallback,
    "job-description-parsing":
      environment.GROQ_JD_PARSING_MODEL?.trim() || fallback,
    "job-requirement-matching":
      environment.GROQ_JOB_MATCHING_MODEL?.trim() || fallback,
  };
}
