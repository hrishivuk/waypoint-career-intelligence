import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ProviderCredentialCipher,
  loadCredentialKeyring,
} from "./credential-crypto";
import {
  credentialFingerprint,
  maskApiKey,
  type AiProvider,
  type ProviderCredentialContext,
} from "./provider-credentials";

type CredentialRow = {
  provider: AiProvider;
  encrypted_secret: string;
  key_version: string;
  fingerprint: string;
  masked_key: string;
  verified_at: string | null;
  updated_at: string;
};

export type CredentialSummary = {
  provider: AiProvider;
  maskedKey: string;
  verifiedAt: string | null;
  updatedAt: string;
};

export class UserCredentialRepository {
  private readonly cipher = new ProviderCredentialCipher(loadCredentialKeyring());

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async list(): Promise<CredentialSummary[]> {
    const { data, error } = await this.client
      .from("user_ai_provider_credentials")
      .select("provider,masked_key,verified_at,updated_at")
      .eq("user_id", this.userId)
      .order("provider");
    if (error) throw error;
    return (data ?? []).map((row) => ({
      provider: row.provider as AiProvider,
      maskedKey: String(row.masked_key),
      verifiedAt: row.verified_at ? String(row.verified_at) : null,
      updatedAt: String(row.updated_at),
    }));
  }

  async save(provider: AiProvider, apiKey: string, verified = false) {
    const normalized = apiKey.trim();
    const encrypted = this.cipher.encrypt(normalized, {
      userId: this.userId,
      provider,
    });
    const { error } = await this.client.from("user_ai_provider_credentials").upsert(
      {
        user_id: this.userId,
        provider,
        encrypted_secret: encrypted.encryptedSecret,
        key_version: encrypted.keyVersion,
        fingerprint: credentialFingerprint(normalized),
        masked_key: maskApiKey(normalized),
        verified_at: verified ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw error;
  }

  async resolve(provider: AiProvider): Promise<ProviderCredentialContext | null> {
    const { data, error } = await this.client
      .from("user_ai_provider_credentials")
      .select("provider,encrypted_secret,key_version,fingerprint,masked_key,verified_at,updated_at")
      .eq("user_id", this.userId)
      .eq("provider", provider)
      .maybeSingle<CredentialRow>();
    if (error) throw error;
    if (!data) return null;
    return {
      userId: this.userId,
      provider,
      apiKey: this.cipher.decrypt(
        { encryptedSecret: data.encrypted_secret, keyVersion: data.key_version },
        { userId: this.userId, provider },
      ),
    };
  }

  async remove(provider: AiProvider): Promise<void> {
    const { error } = await this.client
      .from("user_ai_provider_credentials")
      .delete()
      .eq("user_id", this.userId)
      .eq("provider", provider);
    if (error) throw error;
  }
}
