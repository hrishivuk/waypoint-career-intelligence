import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export async function POST() {
  try {
    const { actor } = await requireAuthenticatedContext();
    const { data, error } = await getSupabaseServerClient().rpc(
      "archive_waypoint_knowledge_v1",
      {
        p_user_id: actor.userId,
        p_pipeline_version: "master-profile-v1-legacy-retirement",
      },
    );
    if (error) throw error;
    return Response.json({ archiveId: data });
  } catch (error) {
    console.error("Knowledge archive failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: { message: "The knowledge archive could not be created." } },
      { status: 500 },
    );
  }
}
