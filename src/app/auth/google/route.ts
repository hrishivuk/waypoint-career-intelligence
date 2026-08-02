import { NextResponse, type NextRequest } from "next/server";
import { authCallbackUrl, safeAuthRedirect } from "@/infrastructure/auth/auth-redirect";
import { createSupabaseAuthServerClient } from "@/infrastructure/auth/supabase-auth-server";

export async function GET(request: NextRequest) {
  const next = safeAuthRedirect(request.nextUrl.searchParams.get("next"));
  try {
    const auth = await createSupabaseAuthServerClient();
    const { data, error } = await auth.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl(request, next), skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error("Missing OAuth URL");
    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error("Google sign in failed", error);
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }
}
