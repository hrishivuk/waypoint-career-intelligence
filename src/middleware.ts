import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const personalToDemo: Record<string, string> = {
  "/profile": "/demo/profile",
  "/knowledge": "/demo/knowledge",
  "/cvs": "/demo/cvs",
  "/jobs/new": "/demo/jobs",
  "/application-kit": "/demo/application-kit",
};

export async function middleware(request: NextRequest) {
  const mode = request.cookies.get("waypoint_workspace")?.value;
  const path = request.nextUrl.pathname;

  if (path.startsWith("/demo")) {
    return mode === "demo"
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/", request.url));
  }

  if (!mode) return NextResponse.redirect(new URL("/", request.url));
  if (mode === "demo") {
    const destination = Object.entries(personalToDemo).find(
      ([personal]) => path === personal || path.startsWith(`${personal}/`),
    )?.[1];
    return NextResponse.redirect(new URL(destination ?? "/", request.url));
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return process.env.NODE_ENV === "production"
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user
    ? response
    : NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/knowledge/:path*",
    "/cvs/:path*",
    "/jobs/:path*",
    "/application-kit/:path*",
    "/demo/:path*",
  ],
};
