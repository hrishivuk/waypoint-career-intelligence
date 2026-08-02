import { z } from "zod";
import { authCallbackUrl } from "@/infrastructure/auth/auth-redirect";
import { createSupabaseAuthServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { authError, emailSchema } from "../_shared";

const schema = z.object({ email: emailSchema }).strict();

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return authError("Enter a valid email address.");
    const auth = await createSupabaseAuthServerClient();
    await auth.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: authCallbackUrl(request, "/reset-password"),
    });
    // Always return success to avoid disclosing whether an account exists.
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Password recovery failed", error);
    return authError("Password recovery is temporarily unavailable.", 500);
  }
}
