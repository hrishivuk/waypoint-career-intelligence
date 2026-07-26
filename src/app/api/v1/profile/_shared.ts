import { z } from "zod";

import {
  CreateManualProfileFact,
  InvalidProfileFactError,
  InvalidProfileFactTransitionError,
  ListProfileFacts,
  ProfileFactNotFoundError,
  UpdateProfileFactValue,
} from "@/application/profile";
import { FixedPrototypeIdentityProvider } from "@/infrastructure/auth/fixed-prototype-identity";
import { SupabaseProfileFactRepository } from "@/infrastructure/persistence/profile";

export const profileFactCategorySchema = z.enum([
  "career_goal",
  "interest",
  "preference",
  "deal_breaker",
  "eligibility",
  "skill",
  "experience",
  "achievement",
  "education",
  "writing_style",
]);

export const profileFactConfirmationSchema = z.enum([
  "confirmed",
  "rejected",
]);

export const identityProvider = new FixedPrototypeIdentityProvider();
export const profileFactRepository = new SupabaseProfileFactRepository();
const systemClock = { now: () => new Date() };
export const listProfileFacts = new ListProfileFacts(profileFactRepository);
export const createManualProfileFact = new CreateManualProfileFact({
  facts: profileFactRepository,
  ids: { generate: () => crypto.randomUUID() },
  clock: systemClock,
});
export const updateProfileFactValue = new UpdateProfileFactValue({
  facts: profileFactRepository,
  clock: systemClock,
});

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return Response.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidJsonError();
  }
}

export class InvalidJsonError extends Error {}

export function handleProfileApiError(error: unknown): Response {
  if (error instanceof InvalidJsonError) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  if (error instanceof ProfileFactNotFoundError) {
    return apiError(404, "PROFILE_FACT_NOT_FOUND", error.message);
  }
  if (error instanceof InvalidProfileFactTransitionError) {
    return apiError(409, "INVALID_PROFILE_FACT_TRANSITION", error.message);
  }
  if (error instanceof InvalidProfileFactError) {
    return apiError(400, "VALIDATION_ERROR", error.message);
  }

  console.error("Profile API request failed", error);
  return apiError(
    500,
    "INTERNAL_ERROR",
    "The profile request could not be completed.",
  );
}
