import { z } from "zod";

import {
  apiError,
  handleProfileApiError,
  createProfileServices,
  profileFactConfirmationSchema,
  readJson,
} from "../../_shared";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";

export const dynamic = "force-dynamic";

const profileFactIdSchema = z.uuid();
const updateProfileFactSchema = z
  .object({
    statement: z.string().trim().min(1).max(5_000).optional(),
    confirmation: profileFactConfirmationSchema.optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.statement !== undefined || input.confirmation !== undefined,
    "At least one update is required.",
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsedId = profileFactIdSchema.safeParse((await params).id);
    if (!parsedId.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        "Profile fact id must be a UUID.",
      );
    }

    const parsed = updateProfileFactSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        "Profile fact update is invalid.",
        parsed.error.flatten(),
      );
    }

    const { actor, client } = await requireAuthenticatedContext();
    const { updateProfileFactValue } = createProfileServices(client);
    const fact = await updateProfileFactValue.execute({
      candidateId: actor.userId,
      factId: parsedId.data,
      ...parsed.data,
    });
    return Response.json({ fact });
  } catch (error) {
    return handleProfileApiError(error);
  }
}
