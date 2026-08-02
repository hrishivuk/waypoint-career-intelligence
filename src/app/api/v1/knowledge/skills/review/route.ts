import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export async function GET() {
  try {
    const actor = await new SupabaseIdentityProvider().getActor();
    const client = getSupabaseServerClient();
    const { data: batches, error: batchError } = await client
      .from("skill_model_review_batches")
      .select("id,status,source_name,created_at")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (batchError) throw batchError;
    const batch = batches?.[0];
    if (!batch) return Response.json({ batch: null, items: [] });
    const { data: items, error } = await client
      .from("skill_model_review_items")
      .select("*")
      .eq("user_id", actor.userId)
      .eq("batch_id", batch.id)
      .order("destination")
      .order("canonical_name");
    if (error) throw error;
    return Response.json({ batch, items: items ?? [] });
  } catch {
    return Response.json(
      { error: { message: "Skill review data could not be loaded." } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await new SupabaseIdentityProvider().getActor();
    const body = (await request.json()) as {
      id?: unknown;
      decision?: unknown;
      level?: unknown;
      notes?: unknown;
      action?: unknown;
    };
    if (body.action === "confirm_all_non_conflicting") {
      const client = getSupabaseServerClient();
      const { data: pending, error: pendingError } = await client
        .from("skill_model_review_items")
        .select("id,blocker_codes,proposed_level")
        .eq("user_id", actor.userId)
        .eq("review_status", "pending");
      if (pendingError) throw pendingError;
      const ids = (pending ?? [])
        .filter(
          (item) =>
            item.proposed_level &&
            !item.blocker_codes.includes("explicit_assessment_conflict") &&
            !item.blocker_codes.includes("merged_levels_disagree"),
        )
        .map((item) => item.id);
      if (ids.length) {
        const now = new Date().toISOString();
        const { error } = await client
          .from("skill_model_review_items")
          .update({
            review_status: "confirmed",
            reviewed_at: now,
            updated_at: now,
          })
          .eq("user_id", actor.userId)
          .in("id", ids);
        if (error) throw error;
      }
      return Response.json({ confirmed: ids.length });
    }
    if (
      typeof body.id !== "string" ||
      !["confirmed", "corrected", "rejected"].includes(String(body.decision))
    ) {
      return Response.json(
        { error: { message: "A valid review decision is required." } },
        { status: 400 },
      );
    }
    const levels = ["learning", "basic", "working", "strong", "expert"];
    const level =
      typeof body.level === "string" && levels.includes(body.level)
        ? body.level
        : null;
    if (body.decision !== "rejected" && !level) {
      return Response.json(
        { error: { message: "Choose a proficiency level first." } },
        { status: 400 },
      );
    }
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from("skill_model_review_items")
      .update({
        review_status: body.decision,
        corrected_level:
          body.decision === "rejected" ? null : level,
        review_notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("user_id", actor.userId)
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ item: data });
  } catch {
    return Response.json(
      { error: { message: "The skill review could not be saved." } },
      { status: 500 },
    );
  }
}
