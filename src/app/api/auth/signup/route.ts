import { z } from "zod";
import { authCallbackUrl } from "@/infrastructure/auth/auth-redirect";
import { createSupabaseAuthServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { resolvePostAuthRedirect } from "@/infrastructure/auth/post-auth-redirect";
import { authError, emailSchema, passwordSchema } from "../_shared";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(100),
  next: z.string().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return authError("Enter your name, a valid email, and a password of at least 8 characters.");

    const { email, password, displayName, next } = parsed.data;
    const auth = await createSupabaseAuthServerClient();
    const { data, error } = await auth.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: authCallbackUrl(request, next),
      },
    });

    if (error) return authError("We couldn't create that account. Check your details or try signing in.");
    return Response.json({
      ok: true,
      confirmationRequired: !data.session,
      redirectTo: data.session ? await resolvePostAuthRedirect(auth, next) : undefined,
    });
  } catch (error) {
    console.error("Sign up failed", error);
    return authError("Account creation is temporarily unavailable.", 500);
  }
}
