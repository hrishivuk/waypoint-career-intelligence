import { z } from "zod";

import { FixedPrototypeIdentityProvider } from "@/infrastructure/auth/fixed-prototype-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

const identity = new FixedPrototypeIdentityProvider();
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
    const actor = await identity.getActor();
    const { id } = await params;
    const client = getSupabaseServerClient();
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
    console.error("Career narrative review failed", error);
    return Response.json(
      { error: { message: "The narrative review could not be saved." } },
      { status: 500 },
    );
  }
}
