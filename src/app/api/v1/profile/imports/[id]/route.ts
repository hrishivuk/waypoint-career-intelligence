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
  ).min(1),
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
    const { client } = await requireAuthenticatedContext();
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json(
        { error: { message: "Narrative review identifier is invalid." } },
        { status: 400 },
      );
    }
    if (!parsed.data.activate) {
      return Response.json(
        { error: { message: "A narrative review must be completed atomically." } },
        { status: 400 },
      );
    }
    const uniqueIds = new Set(parsed.data.decisions.map(({ id }) => id));
    if (uniqueIds.size !== parsed.data.decisions.length) {
      return Response.json(
        { error: { message: "Narrative review decisions contain duplicates." } },
        { status: 400 },
      );
    }
    const { data, error } = await client.rpc(
      "review_and_activate_career_narrative_import_v1",
      { p_import_id: id, p_decisions: parsed.data.decisions },
    );
    if (error?.code === "P0002") {
      return Response.json(
        { error: { message: "The staged narrative review was not found." } },
        { status: 404 },
      );
    }
    if (error?.code === "P0001") {
      return Response.json(
        {
          error: {
            message:
              "The review changed before it could be saved. Reload it and check every decision again.",
          },
        },
        { status: 409 },
      );
    }
    if (error) throw error;
    return Response.json({ activated: Number(data ?? 0) });
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
