import "server-only";

import { z } from "zod";

import type { CareerAiGateway } from "./gateway";
import { GroqCareerAiGateway } from "./groq-career-ai-gateway";
import { loadOpenAiConfig } from "./config";
import { OpenAiCareerAiGateway } from "./openai-career-ai-gateway";
import {
  AiProviderSchema,
  ProviderCredentialContextSchema,
  type AiProvider,
  type ProviderCredentialContext,
} from "./provider-credentials";

const providerSchema = AiProviderSchema.default("openai");

export function configuredAiProvider(
  environment: NodeJS.ProcessEnv = process.env,
): AiProvider {
  return providerSchema.parse(environment.AI_PROVIDER);
}

export function createCareerAiGateway(
  environment: NodeJS.ProcessEnv = process.env,
  credential?: ProviderCredentialContext,
): CareerAiGateway {
  const parsedCredential = credential
    ? ProviderCredentialContextSchema.parse(credential)
    : undefined;
  const provider =
    parsedCredential?.provider ?? configuredAiProvider(environment);
  if (provider === "groq") {
    const apiKey =
      parsedCredential?.apiKey ??
      z
        .string()
        .trim()
        .min(1, "GROQ_API_KEY is required when AI_PROVIDER=groq")
        .parse(environment.GROQ_API_KEY);
    return new GroqCareerAiGateway({
      apiKey,
      models: configuredGroqModels(environment),
    });
  }
  if (parsedCredential) {
    const config = loadOpenAiConfig({
      ...environment,
      OPENAI_API_KEY: parsedCredential.apiKey,
    });
    return new OpenAiCareerAiGateway(config);
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
