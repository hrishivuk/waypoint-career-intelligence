import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export async function POST(request: Request) {
  try {
    const actor = await new SupabaseIdentityProvider().getActor();
    const body = (await request.json()) as {
      kind?: unknown;
      names?: unknown;
      details?: unknown;
      sourceRequirement?: unknown;
    };
    const kind = body.kind;
    const names = Array.isArray(body.names)
      ? body.names
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.trim())
          .filter(Boolean)
      : [];
    if (
      !["skill", "competency", "evidence", "preference"].includes(String(kind)) ||
      names.length === 0
    ) {
      return Response.json(
        { error: { message: "Choose a knowledge type and provide a name." } },
        { status: 400 },
      );
    }
    const client = getSupabaseServerClient();
    const now = new Date().toISOString();
    const sourceRef = {
      entered_by: "user",
      workflow: "job_analysis_correction",
      source_requirement:
        typeof body.sourceRequirement === "string"
          ? body.sourceRequirement
          : null,
    };
    let saved = 0;

    if (kind === "skill") {
      for (const name of names) {
        const { data: existing, error: findError } = await client
          .from("skills")
          .select("id")
          .eq("user_id", actor.userId)
          .ilike("name", name)
          .maybeSingle();
        if (findError) throw findError;
        if (existing) {
          const { error } = await client
            .from("skills")
            .update({ status: "confirmed", last_confirmed_at: now })
            .eq("id", existing.id)
            .eq("user_id", actor.userId);
          if (error) throw error;
        } else {
          const { error } = await client.from("skills").insert({
            user_id: actor.userId,
            name,
            description:
              typeof body.details === "string" && body.details.trim()
                ? body.details.trim()
                : null,
            status: "confirmed",
            confidence: 1,
            source_type: "user_correction",
            source_ref: sourceRef,
            last_confirmed_at: now,
            tags: ["user-confirmed", "job-analysis-correction"],
          });
          if (error) throw error;
        }
        saved += 1;
      }
    } else if (kind === "competency") {
      for (const name of names) {
        const canonicalSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const category =
          /growth|learning/i.test(name)
            ? "learning"
            : /collaborat/i.test(name)
              ? "collaboration"
              : /communicat|documentation/i.test(name)
                ? "communication"
                : "problem_solving";
        const { error } = await client
          .from("professional_competencies")
          .upsert(
            {
              user_id: actor.userId,
              canonical_slug: canonicalSlug,
              name,
              category,
              description:
                typeof body.details === "string" && body.details.trim()
                  ? body.details.trim()
                  : typeof body.sourceRequirement === "string"
                    ? body.sourceRequirement
                    : null,
              status: "confirmed",
              confidence: 1,
              source_type: "user_correction",
              source_ref: sourceRef,
              last_confirmed_at: now,
              tags: ["user-confirmed", "job-analysis-correction"],
              updated_at: now,
            },
            { onConflict: "user_id,canonical_slug" },
          );
        if (error) throw error;
        saved += 1;
      }
    } else if (kind === "evidence") {
      const details =
        typeof body.details === "string" ? body.details.trim() : "";
      if (!details) {
        return Response.json(
          { error: { message: "Evidence needs a short factual description." } },
          { status: 400 },
        );
      }
      const { error } = await client.from("evidence_records").insert(
        names.map((name) => ({
          user_id: actor.userId,
          kind: "responsibility",
          title: name,
          narrative: details,
          status: "confirmed",
          confidence: 1,
          source_type: "user_correction",
          source_ref: sourceRef,
          last_confirmed_at: now,
          tags: ["user-confirmed", "job-analysis-correction"],
        })),
      );
      if (error) throw error;
      saved = names.length;
    } else {
      const { error } = await client.from("typed_preferences").insert(
        names.map((name) => ({
          user_id: actor.userId,
          record_type: "constraint",
          subject: name,
          value: {
            statement:
              typeof body.details === "string" && body.details.trim()
                ? body.details.trim()
                : name,
          },
          strength: "preferred",
          status: "confirmed",
          confidence: 1,
          source_type: "user_correction",
          source_ref: sourceRef,
          last_confirmed_at: now,
          tags: ["user-confirmed", "job-analysis-correction"],
        })),
      );
      if (error) throw error;
      saved = names.length;
    }
    return Response.json({ saved });
  } catch (error) {
    console.error("Knowledge correction failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: { message: "The knowledge correction could not be saved." } },
      { status: 500 },
    );
  }
}
