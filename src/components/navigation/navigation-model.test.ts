import { describe, expect, it } from "vitest";

import {
  isNavigationItemActive,
  primaryNavigation,
  utilityNavigation,
} from "./navigation-model";

describe("navigation model", () => {
  it("defines the approved primary destinations in workflow order", () => {
    expect(primaryNavigation).toEqual([
      { href: "/", label: "Home" },
      { href: "/knowledge", label: "Career Profile", aliases: ["/profile"] },
      { href: "/cvs", label: "CVs" },
      { href: "/jobs", label: "Jobs" },
      { href: "/application-kit", label: "Application Kit" },
    ]);
  });

  it("keeps Settings in utility navigation", () => {
    expect(utilityNavigation).toEqual([
      { href: "/settings", label: "Settings" },
    ]);
  });

  it("does not expose onboarding in persistent navigation", () => {
    const persistentItems = [...primaryNavigation, ...utilityNavigation];

    expect(persistentItems).not.toContainEqual(
      expect.objectContaining({ href: "/onboarding" }),
    );
  });
});

describe("active navigation matching", () => {
  it("matches Home only at the root", () => {
    expect(isNavigationItemActive("/", "/")).toBe(true);
    expect(isNavigationItemActive("/jobs", "/")).toBe(false);
  });

  it.each([
    ["/knowledge", "/knowledge"],
    ["/knowledge/review", "/knowledge"],
    ["/cvs/example-cv", "/cvs"],
    ["/jobs", "/jobs"],
    ["/jobs/new", "/jobs"],
    ["/jobs/example-job/requirements", "/jobs"],
    ["/application-kit/details", "/application-kit"],
    ["/settings/account", "/settings"],
  ])("marks %s active under %s", (pathname, href) => {
    expect(isNavigationItemActive(pathname, href)).toBe(true);
  });

  it("does not match routes that only share a text prefix", () => {
    expect(isNavigationItemActive("/profiled", "/profile")).toBe(false);
    expect(isNavigationItemActive("/jobsmith", "/jobs")).toBe(false);
  });

  it("supports workflow aliases without changing the primary destination", () => {
    expect(isNavigationItemActive("/profile", "/knowledge", ["/profile"])).toBe(true);
    expect(isNavigationItemActive("/profile/review", "/knowledge", ["/profile"])).toBe(true);
  });

  it("normalizes trailing slashes and ignores query strings or fragments", () => {
    expect(isNavigationItemActive("/jobs/new/?source=home#form", "/jobs/")).toBe(
      true,
    );
  });
});
