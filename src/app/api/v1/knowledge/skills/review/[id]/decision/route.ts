import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const redirect = new URL("/knowledge/skills/review", request.url);
  try {
    const actor = await new SupabaseIdentityProvider().getActor();
    const { id } = await params;
    const form = await request.formData();
    const decision = String(form.get("decision") ?? "");
    const level = String(form.get("level") ?? "");
    if (!["confirmed", "corrected", "rejected"].includes(decision)) {
      redirect.searchParams.set("error", "Choose a valid decision.");
      return Response.redirect(redirect, 303);
    }
    if (
      decision !== "rejected" &&
      !["learning", "basic", "working", "strong", "expert"].includes(level)
    ) {
      redirect.searchParams.set("error", "Choose a proficiency level.");
      return Response.redirect(redirect, 303);
    }
    const now = new Date().toISOString();
    const { error } = await getSupabaseServerClient()
      .from("skill_model_review_items")
      .update({
        review_status: decision,
        corrected_level: decision === "rejected" ? null : level,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", actor.userId);
    if (error) throw error;
    redirect.searchParams.set("saved", "1");
    return Response.redirect(redirect, 303);
  } catch {
    redirect.searchParams.set("error", "The review could not be saved.");
    return Response.redirect(redirect, 303);
  }
}
