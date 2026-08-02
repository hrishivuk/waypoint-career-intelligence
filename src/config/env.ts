import "server-only";

import { z } from "zod";

const optionalServerEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  AI_PROVIDER: z.enum(["openai", "groq"]).default("openai"),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),
  AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: z.string().min(1).optional(),
  AI_CREDENTIAL_ENCRYPTION_KEYS: z.string().min(1).optional(),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof optionalServerEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= optionalServerEnvSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    AI_PROVIDER: process.env.AI_PROVIDER,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    AI_CREDENTIAL_ENCRYPTION_KEY_VERSION:
      process.env.AI_CREDENTIAL_ENCRYPTION_KEY_VERSION,
    AI_CREDENTIAL_ENCRYPTION_KEYS: process.env.AI_CREDENTIAL_ENCRYPTION_KEYS,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return cachedEnv;
}

export function getConfiguredServices() {
  const env = getServerEnv();

  return {
    openai: Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL),
    groq: Boolean(env.GROQ_API_KEY),
    selectedAiProvider: env.AI_PROVIDER,
    selectedAiConfigured:
      env.AI_PROVIDER === "groq"
        ? Boolean(env.GROQ_API_KEY)
        : Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL),
    supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseAuth: Boolean(
      (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL) &&
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
