import { z } from "zod";
import { createSupabaseAuthServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { authError, passwordSchema } from "../_shared";

const schema = z.object({ password: passwordSchema }).strict();

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return authError("Use a password of at least 8 characters.");
    const auth = await createSupabaseAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return authError("Your recovery link has expired. Request a new one.", 401);
    const { error } = await auth.auth.updateUser({ password: parsed.data.password });
    if (error) return authError("We couldn't update your password. Request a new recovery link.");
    return Response.json({ ok: true, redirectTo: "/login?password=updated" });
  } catch (error) {
    console.error("Password update failed", error);
    return authError("Password update is temporarily unavailable.", 500);
  }
}
