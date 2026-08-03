import {
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";
import { loadApplicationKit } from "@/infrastructure/application-kit/application-kit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, client } = await requireAuthenticatedContext();
    return Response.json({
      sections: await loadApplicationKit(client, actor.userId),
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error("Application Kit load failed", error);
    return Response.json(
      { error: "Unable to load the Application Kit. Make sure its migration has been run." },
      { status: 500 },
    );
  }
}
