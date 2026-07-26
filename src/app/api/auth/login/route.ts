import { cookies } from "next/headers";
import { z } from "zod";

import { WORKSPACE_COOKIE } from "@/domain/workspace";
import { createSupabaseAuthServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

const schema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Enter a valid email and password." }, { status: 400 });
    }
    const auth = await createSupabaseAuthServerClient();
    const { data, error } = await auth.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const profile = await getSupabaseServerClient()
      .from("prototype_users")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) {
      await auth.auth.signOut();
      return Response.json(
        { error: "This account is not linked to the private Waypoint profile." },
        { status: 403 },
      );
    }
    (await cookies()).set(WORKSPACE_COOKIE, "personal", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      priority: "high",
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Personal login failed", error);
    return Response.json({ error: "Personal sign-in is not configured yet." }, { status: 500 });
  }
}

