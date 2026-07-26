import { type NextRequest, NextResponse } from "next/server";

const personalToDemo: Record<string, string> = {
  "/profile": "/demo/profile",
  "/knowledge": "/demo/knowledge",
  "/cvs": "/demo/cvs",
  "/jobs/new": "/demo/jobs",
  "/application-kit": "/demo/application-kit",
};

export function proxy(request: NextRequest) {
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
  return NextResponse.next();
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

