const DEFAULT_AUTH_REDIRECT = "/";

export function safeAuthRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const url = new URL(value, "https://waypoint.local");
    return url.origin === "https://waypoint.local"
      ? `${url.pathname}${url.search}${url.hash}`
      : DEFAULT_AUTH_REDIRECT;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}

export function authCallbackUrl(request: Request, next?: string) {
  const url = new URL("/auth/callback", new URL(request.url).origin);
  url.searchParams.set("next", safeAuthRedirect(next));
  return url.toString();
}
