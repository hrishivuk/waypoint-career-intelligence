import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { z } from "zod";

import type { AiProvider } from "./provider-credentials";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

const EncryptedCredentialEnvelopeSchema = z.object({
  v: z.literal(1),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
});

export interface CredentialKeyring {
  currentVersion: string;
  keys: Readonly<Record<string, Buffer>>;
}

export interface CredentialIdentity {
  userId: string;
  provider: AiProvider;
}

export interface EncryptedCredential {
  encryptedSecret: string;
  keyVersion: string;
}

export class CredentialEncryptionError extends Error {
  constructor(message = "The provider credential could not be processed.") {
    super(message);
    this.name = "CredentialEncryptionError";
  }
}

export function loadCredentialKeyring(
  environment: NodeJS.ProcessEnv = process.env,
): CredentialKeyring {
  const currentVersion = z
    .string()
    .trim()
    .min(1, "AI_CREDENTIAL_ENCRYPTION_KEY_VERSION is required")
    .parse(environment.AI_CREDENTIAL_ENCRYPTION_KEY_VERSION);
  const serialized = z
    .string()
    .trim()
    .min(1, "AI_CREDENTIAL_ENCRYPTION_KEYS is required")
    .parse(environment.AI_CREDENTIAL_ENCRYPTION_KEYS);

  let encodedKeys: unknown;
  try {
    encodedKeys = JSON.parse(serialized);
  } catch {
    throw new CredentialEncryptionError(
      "AI_CREDENTIAL_ENCRYPTION_KEYS must be a JSON object.",
    );
  }

  const parsed = z.record(z.string(), z.string().min(1)).parse(encodedKeys);
  const keys = Object.fromEntries(
    Object.entries(parsed).map(([version, encoded]) => {
      const key = Buffer.from(encoded, "base64");
      if (key.length !== 32) {
        throw new CredentialEncryptionError(
          `Encryption key version ${version} must decode to 32 bytes.`,
        );
      }
      return [version, key];
    }),
  );

  if (!keys[currentVersion]) {
    throw new CredentialEncryptionError(
      "The current credential encryption key version is unavailable.",
    );
  }
  return { currentVersion, keys };
}

export class ProviderCredentialCipher {
  constructor(private readonly keyring: CredentialKeyring) {}

  encrypt(secret: string, identity: CredentialIdentity): EncryptedCredential {
    const key = this.keyring.keys[this.keyring.currentVersion];
    if (!key || key.length !== 32 || !secret) {
      throw new CredentialEncryptionError();
    }
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(aad(identity));
    const ciphertext = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    const envelope = {
      v: 1 as const,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    return {
      encryptedSecret: Buffer.from(JSON.stringify(envelope)).toString("base64url"),
      keyVersion: this.keyring.currentVersion,
    };
  }

  decrypt(encrypted: EncryptedCredential, identity: CredentialIdentity): string {
    const key = this.keyring.keys[encrypted.keyVersion];
    if (!key || key.length !== 32) throw new CredentialEncryptionError();
    try {
      const decoded = Buffer.from(encrypted.encryptedSecret, "base64url").toString();
      const envelope = EncryptedCredentialEnvelopeSchema.parse(JSON.parse(decoded));
      const decipher = createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(envelope.iv, "base64"),
      );
      decipher.setAAD(aad(identity));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new CredentialEncryptionError();
    }
  }
}

function aad(identity: CredentialIdentity): Buffer {
  return Buffer.from(`waypoint:ai-credential:${identity.userId}:${identity.provider}`);
}
