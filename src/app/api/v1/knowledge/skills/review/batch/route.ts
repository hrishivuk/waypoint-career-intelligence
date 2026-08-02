import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

const levels = ["learning", "basic", "working", "strong", "expert"];

export async function POST(request: Request) {
  const redirect = new URL("/knowledge/skills/review", request.url);
  try {
    const actor = await new SupabaseIdentityProvider().getActor();
    const form = await request.formData();
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

    const { data: items, error } = await client
      .from("skill_model_review_items")
      .select("id,proposed_level")
      .eq("user_id", actor.userId)
      .eq("batch_id", batch.id);
    if (error) throw error;
    let saved = 0;
    const now = new Date().toISOString();
    for (const item of items ?? []) {
      const selection = String(form.get(`level:${item.id}`) ?? "");
      if (!selection) continue;
      const rejected = selection === "reject";
      if (!rejected && !levels.includes(selection)) {
        throw new Error("Invalid proficiency selection.");
      }
      const reviewStatus = rejected
        ? "rejected"
        : selection === item.proposed_level
          ? "confirmed"
          : "corrected";
      const { error: updateError } = await client
        .from("skill_model_review_items")
        .update({
          review_status: reviewStatus,
          corrected_level:
            rejected || reviewStatus === "confirmed" ? null : selection,
          reviewed_at: now,
          updated_at: now,
        })
        .eq("id", item.id)
        .eq("user_id", actor.userId);
      if (updateError) throw updateError;
      saved += 1;
    }
    const { error: batchUpdateError } = await client
      .from("skill_model_review_batches")
      .update({
        status: "reviewed",
        updated_at: now,
      })
      .eq("id", batch.id)
      .eq("user_id", actor.userId);
    if (batchUpdateError) throw batchUpdateError;

    redirect.searchParams.set("saved", String(saved));
    return Response.redirect(redirect, 303);
  } catch {
    redirect.searchParams.set("error", "The batch review could not be saved.");
    return Response.redirect(redirect, 303);
  }
}
