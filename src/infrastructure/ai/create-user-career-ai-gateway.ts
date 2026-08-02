import "server-only";

import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";
import { consumeUsage } from "@/infrastructure/usage/consume-usage";

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

export async function createUserCareerAiGateway(userId: string): Promise<CareerAiGateway> {
  const client = getSupabaseServerClient();
  const repository = new UserCredentialRepository(client, userId);
  const { data: state, error } = await client
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
      await consumeUsage(userId, "ai_requests");
      return createCareerAiGateway(process.env, credential);
    }
  }
  throw new AiCredentialRequiredError();
}
