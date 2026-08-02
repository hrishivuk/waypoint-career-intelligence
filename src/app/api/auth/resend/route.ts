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
    await auth.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: authCallbackUrl(request) } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Confirmation resend failed", error);
    return authError("We couldn't resend the confirmation email.", 500);
  }
}
