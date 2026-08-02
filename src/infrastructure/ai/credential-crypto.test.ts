import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CredentialEncryptionError,
  ProviderCredentialCipher,
  loadCredentialKeyring,
} from "./credential-crypto";

const identity = {
  userId: "11111111-1111-4111-8111-111111111111",
  provider: "openai" as const,
};

describe("ProviderCredentialCipher", () => {
  it("round trips a secret without placing plaintext in the envelope", () => {
    const cipher = new ProviderCredentialCipher({
      currentVersion: "v1",
      keys: { v1: randomBytes(32) },
    });
    const encrypted = cipher.encrypt("sk-super-secret", identity);

    expect(encrypted.keyVersion).toBe("v1");
    expect(encrypted.encryptedSecret).not.toContain("sk-super-secret");
    expect(cipher.decrypt(encrypted, identity)).toBe("sk-super-secret");
  });

  it("binds ciphertext to both the user and provider using AAD", () => {
    const cipher = new ProviderCredentialCipher({
      currentVersion: "v1",
      keys: { v1: randomBytes(32) },
    });
    const encrypted = cipher.encrypt("secret", identity);

    expect(() =>
      cipher.decrypt(encrypted, { ...identity, provider: "groq" }),
    ).toThrow(CredentialEncryptionError);
    expect(() =>
      cipher.decrypt(encrypted, {
        ...identity,
        userId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow(CredentialEncryptionError);
  });

  it("decrypts old key versions after a current-key rotation", () => {
    const v1 = randomBytes(32);
    const encrypted = new ProviderCredentialCipher({
      currentVersion: "v1",
      keys: { v1 },
    }).encrypt("secret", identity);
    const rotated = new ProviderCredentialCipher({
      currentVersion: "v2",
      keys: { v1, v2: randomBytes(32) },
    });

    expect(rotated.decrypt(encrypted, identity)).toBe("secret");
    expect(rotated.encrypt("new-secret", identity).keyVersion).toBe("v2");
  });
});

describe("loadCredentialKeyring", () => {
  it("loads a versioned base64 keyring", () => {
    const encoded = randomBytes(32).toString("base64");
    const keyring = loadCredentialKeyring({
      NODE_ENV: "test",
      AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "v1",
      AI_CREDENTIAL_ENCRYPTION_KEYS: JSON.stringify({ v1: encoded }),
    });
    expect(keyring.currentVersion).toBe("v1");
    expect(keyring.keys.v1).toHaveLength(32);
  });

  it("rejects incorrectly sized and missing current keys", () => {
    expect(() =>
      loadCredentialKeyring({
        NODE_ENV: "test",
        AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "v1",
        AI_CREDENTIAL_ENCRYPTION_KEYS: JSON.stringify({
          v1: randomBytes(16).toString("base64"),
        }),
      }),
    ).toThrow(CredentialEncryptionError);
    expect(() =>
      loadCredentialKeyring({
        NODE_ENV: "test",
        AI_CREDENTIAL_ENCRYPTION_KEY_VERSION: "v2",
        AI_CREDENTIAL_ENCRYPTION_KEYS: JSON.stringify({
          v1: randomBytes(32).toString("base64"),
        }),
      }),
    ).toThrow(CredentialEncryptionError);
  });
});
