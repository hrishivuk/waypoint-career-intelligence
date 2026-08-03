export type NavigationItem = Readonly<{
  href: string;
  label: string;
}>;

export const primaryNavigation = [
  { href: "/", label: "Home" },
  { href: "/profile", label: "Career Profile" },
  { href: "/cvs", label: "CVs" },
  { href: "/jobs", label: "Jobs" },
  { href: "/application-kit", label: "Application Kit" },
] as const satisfies readonly NavigationItem[];

export const utilityNavigation = [
  { href: "/settings", label: "Settings" },
] as const satisfies readonly NavigationItem[];

/**
 * Matches a navigation destination to its route and nested routes. Home is an
 * exact match so it does not become active for every pathname.
 */
export function isNavigationItemActive(pathname: string, href: string) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedHref = normalizePathname(href);

  if (normalizedHref === "/") return normalizedPathname === "/";

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";

  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = pathOnly.startsWith("/")
    ? pathOnly
    : `/${pathOnly}`;

  return withLeadingSlash.replace(/\/+$/, "") || "/";
}
