import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

export const AiProviderSchema = z.enum(["openai", "groq"]);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const ProviderCredentialContextSchema = z.object({
  userId: z.string().uuid(),
  provider: AiProviderSchema,
  apiKey: z.string().trim().min(1),
});

/** Plaintext credential context. Keep this value server-side and short-lived. */
export type ProviderCredentialContext = z.infer<
  typeof ProviderCredentialContextSchema
>;

export interface StoredProviderCredential {
  userId: string;
  provider: AiProvider;
  encryptedSecret: string;
  keyVersion: string;
  fingerprint: string;
  maskedKey: string;
}

export function credentialFingerprint(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex").slice(0, 16);
}

export function maskApiKey(apiKey: string): string {
  const normalized = apiKey.trim();
  const suffix = normalized.length > 4 ? normalized.slice(-4) : "";
  return `${"•".repeat(8)}${suffix}`;
}
