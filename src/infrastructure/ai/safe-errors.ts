import "server-only";

export type AiCredentialErrorCode =
  | "INVALID_CREDENTIAL"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "PROVIDER_UNAVAILABLE"
  | "REQUEST_TIMEOUT"
  | "UNKNOWN_PROVIDER_ERROR";

export class SafeAiProviderError extends Error {
  constructor(
    public readonly code: AiCredentialErrorCode,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SafeAiProviderError";
  }
}

export function classifyProviderError(error: unknown): SafeAiProviderError {
  const status = readStatus(error);
  const code = readCode(error).toLowerCase();
  if (status === 401 || status === 403 || code.includes("invalid_api_key")) {
    return new SafeAiProviderError(
      "INVALID_CREDENTIAL",
      "The AI provider rejected this API key.",
      false,
    );
  }
  if (status === 429 && (code.includes("quota") || code.includes("billing"))) {
    return new SafeAiProviderError(
      "QUOTA_EXCEEDED",
      "The AI provider account has no available quota.",
      false,
    );
  }
  if (status === 429) {
    return new SafeAiProviderError(
      "RATE_LIMITED",
      "The AI provider is rate limiting requests. Try again shortly.",
      true,
    );
  }
  if (status === 408 || code.includes("timeout") || code === "etimedout") {
    return new SafeAiProviderError(
      "REQUEST_TIMEOUT",
      "The AI provider request timed out.",
      true,
    );
  }
  if (status !== undefined && status >= 500) {
    return new SafeAiProviderError(
      "PROVIDER_UNAVAILABLE",
      "The AI provider is temporarily unavailable.",
      true,
    );
  }
  return new SafeAiProviderError(
    "UNKNOWN_PROVIDER_ERROR",
    "The AI provider request failed.",
    false,
  );
}

export function safeAiErrorMessage(error: unknown): string {
  if (error instanceof SafeAiProviderError) return error.message;
  if (error instanceof Error && [
    "AiCredentialRequiredError",
    "AiConsentRequiredError",
    "UsageLimitExceededError",
  ].includes(error.name)) return error.message;
  const status = readStatus(error);
  const code = readCode(error);
  if (status !== undefined || code) return classifyProviderError(error).message;
  return "The AI-assisted request could not be completed. Try again shortly.";
}

function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return;
  return typeof error.status === "number" ? error.status : undefined;
}

function readCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  return typeof error.code === "string" ? error.code : "";
}
