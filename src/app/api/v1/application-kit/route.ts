import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { loadApplicationKit } from "@/infrastructure/application-kit/application-kit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await new SupabaseIdentityProvider().getActor();
    return Response.json({ sections: await loadApplicationKit(userId) });
  } catch (error) {
    console.error("Application Kit load failed", error);
    return Response.json(
      { error: "Unable to load the Application Kit. Make sure its migration has been run." },
      { status: 500 },
    );
  }
}
