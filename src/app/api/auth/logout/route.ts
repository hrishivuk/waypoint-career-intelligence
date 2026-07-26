import { cookies } from "next/headers";

import { WORKSPACE_COOKIE } from "@/domain/workspace";
import {
  createSupabaseAuthServerClient,
  isSupabaseAuthConfigured,
} from "@/infrastructure/auth/supabase-auth-server";

export async function POST() {
  if (isSupabaseAuthConfigured()) {
    const auth = await createSupabaseAuthServerClient();
    await auth.auth.signOut();
  }
  const store = await cookies();
  store.delete(WORKSPACE_COOKIE);
  return Response.json({ ok: true });
}

