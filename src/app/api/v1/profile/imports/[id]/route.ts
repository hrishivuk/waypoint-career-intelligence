import { z } from "zod";

import {
  AccountProvisioningRequiredError,
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";

const reviewSchema = z.object({
  decisions: z.array(
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["confirmed", "rejected"]),
    }),
  ),
  activate: z.boolean().default(false),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsed = reviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { message: "Narrative review decisions are invalid." } },
        { status: 400 },
      );
    }
    const { actor, client } = await requireAuthenticatedContext();
    const { id } = await params;
    for (const decision of parsed.data.decisions) {
      const { error } = await client
        .from("career_narrative_candidates")
        .update({ decision: decision.decision })
        .eq("id", decision.id)
        .eq("import_id", id)
        .eq("user_id", actor.userId);
      if (error) throw error;
    }
    let activated = 0;
    if (parsed.data.activate) {
      const { data, error } = await client.rpc(
        "activate_career_narrative_import_v2",
        { p_user_id: actor.userId, p_import_id: id },
      );
      if (error) throw error;
      activated = Number(data ?? 0);
    }
    return Response.json({ activated });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json(
        { error: { message: "Authentication required." } },
        { status: 401 },
      );
    }
    if (error instanceof AccountProvisioningRequiredError) {
      return Response.json(
        { error: { message: "Your Waypoint account is still being prepared." } },
        { status: 503 },
      );
    }
    console.error("Career narrative review failed", error);
    return Response.json(
      { error: { message: "The narrative review could not be saved." } },
      { status: 500 },
    );
  }
}
