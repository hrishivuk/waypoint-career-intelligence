export type CareerProfileNavigationItem = Readonly<{
  id: "overview" | "add" | "review" | "insights" | "attention";
  label: string;
  href: string;
  description: string;
}>;

/**
 * User-facing Career Profile destinations mapped to today's working routes.
 * Keeping the route mapping here lets the shell present one coherent product
 * concept without requiring a route migration.
 */
export const careerProfileNavigation = [
  {
    id: "overview",
    label: "Overview",
    href: "/knowledge",
    description: "See the confirmed information Waypoint can use.",
  },
  {
    id: "add",
    label: "Add information",
    href: "/profile",
    description: "Add career history, skills, projects, or preferences.",
  },
  {
    id: "review",
    label: "Review changes",
    href: "/knowledge/review",
    description: "Confirm, correct, or reject proposed profile changes.",
  },
  {
    id: "insights",
    label: "Insights",
    href: "/knowledge/insights",
    description: "Review patterns, context, and unresolved questions.",
  },
  {
    id: "attention",
    label: "Needs attention",
    href: "/knowledge/exceptions",
    description: "Resolve information Waypoint could not safely activate.",
  },
] as const satisfies readonly CareerProfileNavigationItem[];

export function getActiveCareerProfileItem(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);

  return (
    [...careerProfileNavigation]
      .sort((left, right) => right.href.length - left.href.length)
      .find(({ href }) => matchesRoute(normalizedPathname, href)) ?? null
  );
}

export function isCareerProfileItemActive(pathname: string, href: string) {
  return getActiveCareerProfileItem(pathname)?.href === normalizePathname(href);
}

function matchesRoute(pathname: string, href: string) {
  const normalizedHref = normalizePathname(href);
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

function normalizePathname(pathname: string) {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = pathOnly.startsWith("/")
    ? pathOnly
    : `/${pathOnly}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}
