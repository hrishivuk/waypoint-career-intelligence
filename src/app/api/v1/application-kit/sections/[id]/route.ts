import { z } from "zod";

import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

const schema = z.object({
  title: z.string().trim().min(1).max(100),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Enter a section title." }, { status: 400 });
    }
    const { id } = await context.params;
    const { userId } = await new SupabaseIdentityProvider().getActor();
    const { data, error } = await getSupabaseServerClient()
      .from("application_kit_sections")
      .update({ title: parsed.data.title })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id,title")
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Section not found." }, { status: 404 });
    return Response.json({ section: data });
  } catch (error) {
    console.error("Application Kit section update failed", error);
    return Response.json({ error: "The section could not be updated." }, { status: 500 });
  }
}
