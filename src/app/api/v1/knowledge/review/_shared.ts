import {
  HandoverReviewConflictError,
  HandoverReviewNotFoundError,
  InvalidHandoverReviewError,
  ListActiveHandoverReview,
  ReviewHandoverCandidate,
} from "@/application/handover-review";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthenticationRequiredError } from "@/infrastructure/auth/supabase-identity";
import {
  SupabaseHandoverReviewDataClient,
  SupabaseHandoverReviewRepository,
} from "@/infrastructure/persistence/handover-review";

export function createReviewServices(client: SupabaseClient) {
  const repository = new SupabaseHandoverReviewRepository(
    new SupabaseHandoverReviewDataClient(client),
  );
  return {
    listActiveReview: new ListActiveHandoverReview(repository),
    reviewCandidate: new ReviewHandoverCandidate(repository),
  };
}

export function reviewApiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
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

export async function readReviewJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidReviewJsonError();
  }
}

export class InvalidReviewJsonError extends Error {}

export function handleReviewApiError(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return reviewApiError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
  }
  if (error instanceof InvalidReviewJsonError) {
    return reviewApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  if (error instanceof InvalidHandoverReviewError) {
    return reviewApiError(400, "VALIDATION_ERROR", error.message);
  }
  if (error instanceof HandoverReviewNotFoundError) {
    return reviewApiError(404, "HANDOVER_CANDIDATE_NOT_FOUND", error.message);
  }
  if (error instanceof HandoverReviewConflictError) {
    return reviewApiError(409, "HANDOVER_REVIEW_CONFLICT", error.message);
  }
  console.error("Handover review API request failed", error);
  return reviewApiError(
    500,
    "INTERNAL_ERROR",
    "The handover review request could not be completed.",
  );
}
