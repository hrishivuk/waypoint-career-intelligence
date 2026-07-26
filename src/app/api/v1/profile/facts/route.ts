import { z } from "zod";

import {
  apiError,
  createManualProfileFact,
  handleProfileApiError,
  identityProvider,
  listProfileFacts,
  profileFactCategorySchema,
  readJson,
} from "../_shared";

export const dynamic = "force-dynamic";

const createProfileFactSchema = z
  .object({
    category: profileFactCategorySchema,
    statement: z.string().trim().min(1).max(5_000),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  })
  .strict();

export async function GET() {
  try {
    const actor = await identityProvider.getActor();
    const result = await listProfileFacts.execute(actor.userId);
    return Response.json(result);
  } catch (error) {
    return handleProfileApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createProfileFactSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        "Profile fact is invalid.",
        parsed.error.flatten(),
      );
    }

    const actor = await identityProvider.getActor();
    const fact = await createManualProfileFact.execute({
      candidateId: actor.userId,
      ...parsed.data,
    });
    return Response.json({ fact }, { status: 201 });
  } catch (error) {
    return handleProfileApiError(error);
  }
}
