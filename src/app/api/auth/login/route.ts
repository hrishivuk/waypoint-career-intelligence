import { z } from "zod";
import { createSupabaseAuthServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { resolvePostAuthRedirect } from "@/infrastructure/auth/post-auth-redirect";
import { authError, emailSchema, passwordSchema } from "../_shared";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  next: z.string().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return authError("Enter a valid email and password.");
    }
    const auth = await createSupabaseAuthServerClient();
    const { email, password } = parsed.data;
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return authError("Email or password is incorrect.", 401);
    }
    return Response.json({ ok: true, redirectTo: await resolvePostAuthRedirect(auth, parsed.data.next) });
  } catch (error) {
    console.error("Sign in failed", error);
    return authError("Sign-in is temporarily unavailable.", 500);
  }
}
