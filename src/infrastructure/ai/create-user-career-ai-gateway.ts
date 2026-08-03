import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";
import { withAiUsageLease } from "@/infrastructure/usage/consume-usage";

import { createCareerAiGateway } from "./create-career-ai-gateway";
import type { CareerAiGateway } from "./gateway";
import { AiProviderSchema, type AiProvider } from "./provider-credentials";
import { UserCredentialRepository } from "./user-credential-repository";

export class AiCredentialRequiredError extends Error {
  constructor() {
    super("Add and verify an OpenAI or Groq API key in Settings before using AI features.");
    this.name = "AiCredentialRequiredError";
  }
}

export class AiConsentRequiredError extends Error {
  constructor() {
    super("Review and accept the AI data-processing notice before using AI features.");
    this.name = "AiConsentRequiredError";
  }
}

export async function createUserCareerAiGateway(
  authenticatedClient: SupabaseClient,
  userId: string,
): Promise<CareerAiGateway> {
  const admin = getSupabaseServerClient();
  const repository = new UserCredentialRepository(admin, userId);
  const { data: state, error } = await authenticatedClient
    .from("user_onboarding_state")
    .select("preferred_ai_provider,ai_data_processing_accepted_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!state?.ai_data_processing_accepted_at) throw new AiConsentRequiredError();

  const preferred = AiProviderSchema.safeParse(state?.preferred_ai_provider);
  const providers: AiProvider[] = preferred.success
    ? [preferred.data, preferred.data === "openai" ? "groq" : "openai"]
    : ["openai", "groq"];
  for (const provider of providers) {
    const credential = await repository.resolve(provider);
    if (credential) {
      return withUsageLeases(createCareerAiGateway(process.env, credential), userId);
    }
  }
  throw new AiCredentialRequiredError();
}

function withUsageLeases(gateway: CareerAiGateway, userId: string): CareerAiGateway {
  return {
    extractCareerNarrative: (input) => withAiUsageLease(userId, () => gateway.extractCareerNarrative(input)),
    extractCvFacts: (input) => withAiUsageLease(userId, () => gateway.extractCvFacts(input)),
    parseJobDescription: (input) => withAiUsageLease(userId, () => gateway.parseJobDescription(input)),
    matchJobRequirements: (input) => withAiUsageLease(userId, () => gateway.matchJobRequirements(input)),
  };
}
