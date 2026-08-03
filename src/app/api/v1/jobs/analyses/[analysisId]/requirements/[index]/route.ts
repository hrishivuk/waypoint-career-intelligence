import { z } from "zod";

import {
  AccountProvisioningRequiredError,
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";

const bodySchema = z.object({
  criticality: z.enum([
    "eligibility",
    "mandatory_core",
    "important",
    "preferred",
    "bonus",
    "unclear",
  ]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ analysisId: string; index: string }> },
) {
  try {
    const { client } = await requireAuthenticatedContext();
    const { analysisId, index: rawIndex } = await context.params;
    if (!z.string().uuid().safeParse(analysisId).success) {
      return Response.json(
        { error: { message: "Invalid analysis identifier." } },
        { status: 400 },
      );
    }
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0) {
      return Response.json(
        { error: { message: "Invalid requirement index." } },
        { status: 400 },
      );
    }
    const body = bodySchema.parse(await request.json());
    const { data: updated, error } = await client.rpc(
      "update_job_requirement_criticality_v1",
      {
        target_analysis_id: analysisId,
        target_position: index,
        target_criticality: body.criticality,
      },
    );
    if (error?.code === "P0002") {
      return Response.json(
        { error: { message: "Analysis or requirement was not found." } },
        { status: 404 },
      );
    }
    if (error?.code === "P0001") {
      return Response.json(
        {
          error: {
            message:
              "This saved analysis cannot be updated safely. Run the analysis again.",
          },
        },
        { status: 409 },
      );
    }
    if (error) throw error;
    if (!updated) {
      return Response.json(
        { error: { message: "Analysis or requirement was not found." } },
        { status: 404 },
      );
    }
    return Response.json({ updated: true });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json(
        { error: { message: "Authentication required." } },
        { status: 401 },
      );
    }
    if (error instanceof AccountProvisioningRequiredError) {
      return Response.json(
        { error: { message: "Your account is still being prepared." } },
        { status: 503 },
      );
    }
    return Response.json(
      {
        error: {
          message:
            error instanceof z.ZodError
              ? "Choose a valid requirement importance."
              : "The requirement could not be updated.",
        },
      },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
