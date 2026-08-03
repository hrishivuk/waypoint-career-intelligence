import { z } from "zod";

import {
  handleReviewApiError,
  createReviewServices,
  readReviewJson,
  reviewApiError,
} from "../_shared";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";

export const dynamic = "force-dynamic";

const candidateIdSchema = z.uuid();
const reviewRequestSchema = z
  .object({
    action: z.enum(["confirm", "reject", "correct"]),
    correctedRecord: z.record(z.string(), z.unknown()).optional(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsedId = candidateIdSchema.safeParse((await params).id);
    if (!parsedId.success) {
      return reviewApiError(
        400,
        "VALIDATION_ERROR",
        "Handover candidate id must be a UUID.",
      );
    }
    const parsed = reviewRequestSchema.safeParse(await readReviewJson(request));
    if (!parsed.success) {
      return reviewApiError(
        400,
        "VALIDATION_ERROR",
        "Handover candidate review is invalid.",
        parsed.error.flatten(),
      );
    }
    const { actor, client } = await requireAuthenticatedContext();
    const { reviewCandidate } = createReviewServices(client);
    const candidate = await reviewCandidate.execute({
      candidateId: actor.userId,
      stagedCandidateId: parsedId.data,
      ...parsed.data,
    });
    return Response.json({ candidate });
  } catch (error) {
    return handleReviewApiError(error);
  }
}
