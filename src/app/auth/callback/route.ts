import { NextResponse, type NextRequest } from "next/server";
import { safeAuthRedirect } from "@/infrastructure/auth/auth-redirect";
import { createSupabaseAuthServerClient } from "@/infrastructure/auth/supabase-auth-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeAuthRedirect(request.nextUrl.searchParams.get("next"));
  if (code) {
    const auth = await createSupabaseAuthServerClient();
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
