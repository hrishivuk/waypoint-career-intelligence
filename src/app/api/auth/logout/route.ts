import {
  createSupabaseAuthServerClient,
  isSupabaseAuthConfigured,
} from "@/infrastructure/auth/supabase-auth-server";

export async function POST() {
  if (isSupabaseAuthConfigured()) {
    const auth = await createSupabaseAuthServerClient();
    await auth.auth.signOut();
  }
  return Response.json({ ok: true });
}
