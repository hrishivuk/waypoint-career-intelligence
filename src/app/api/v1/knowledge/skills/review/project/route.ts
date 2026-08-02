import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export async function POST(request: Request) {
  const redirect = new URL("/knowledge/skills/review", request.url);
  try {
    const actor = await new SupabaseIdentityProvider().getActor();
    const client = getSupabaseServerClient();
    const { data: batches, error: batchError } = await client
      .from("skill_model_review_batches")
      .select("id")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (batchError) throw batchError;
    const batch = batches?.[0];
    if (!batch) throw new Error("No staged skill review batch was found.");

    const { data, error } = await client.rpc("project_skill_model_review", {
      requested_batch_id: batch.id,
      requested_user_id: actor.userId,
    });
    if (error) throw error;

    const result = data as { total?: number } | null;
    redirect.searchParams.set("projected", String(result?.total ?? 0));
    return Response.redirect(redirect, 303);
  } catch (error) {
    console.error("Skill model projection failed", error);
    redirect.searchParams.set(
      "error",
      "Reviewed skills could not be activated.",
    );
    return Response.redirect(redirect, 303);
  }
}
