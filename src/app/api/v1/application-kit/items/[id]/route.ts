import { z } from "zod";

import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

const schema = z.object({
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().max(8_000),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Check the answer and try again." }, { status: 400 });
    }
    const { id } = await context.params;
    const { userId } = await new SupabaseIdentityProvider().getActor();
    const { data, error } = await getSupabaseServerClient()
      .from("application_kit_items")
      .update({
        label: parsed.data.label,
        value: parsed.data.value,
        source_kind: "manual",
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id,label,value,source_kind")
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Answer not found." }, { status: 404 });
    return Response.json({ item: data });
  } catch (error) {
    console.error("Application Kit item update failed", error);
    return Response.json({ error: "The answer could not be saved." }, { status: 500 });
  }
}
