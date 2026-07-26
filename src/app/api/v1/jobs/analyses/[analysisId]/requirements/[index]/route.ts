import { z } from "zod";

import { FixedPrototypeIdentityProvider } from "@/infrastructure/auth/fixed-prototype-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

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
    const actor = await new FixedPrototypeIdentityProvider().getActor();
    const { analysisId, index: rawIndex } = await context.params;
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0) {
      return Response.json(
        { error: { message: "Invalid requirement index." } },
        { status: 400 },
      );
    }
    const body = bodySchema.parse(await request.json());
    const client = getSupabaseServerClient();
    const { data: analysis, error: analysisError } = await client
      .from("analyses")
      .select("job_id")
      .eq("id", analysisId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (analysisError || !analysis) {
      return Response.json(
        { error: { message: "Analysis was not found." } },
        { status: 404 },
      );
    }
    const { data: requirements, error: requirementsError } = await client
      .from("job_requirements")
      .select("id,metadata")
      .eq("user_id", actor.userId)
      .eq("job_id", analysis.job_id)
      .order("created_at");
    if (requirementsError || !requirements?.[index]) {
      return Response.json(
        { error: { message: "Requirement was not found." } },
        { status: 404 },
      );
    }
    const requirement = requirements[index];
    const priority =
      body.criticality === "unclear"
        ? "unclear"
        : body.criticality === "preferred" || body.criticality === "bonus"
          ? "preferred"
          : "required";
    const { error } = await client
      .from("job_requirements")
      .update({
        criticality: body.criticality,
        criticality_is_explicit: true,
        is_required: priority === "required",
        metadata: {
          ...((requirement.metadata as Record<string, unknown> | null) ?? {}),
          priority,
          corrected_by_user: true,
        },
      })
      .eq("id", requirement.id)
      .eq("user_id", actor.userId);
    if (error) throw error;
    return Response.json({ updated: true });
  } catch (error) {
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
