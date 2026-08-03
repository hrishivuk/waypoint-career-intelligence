import { describe, expect, it } from "vitest";

import {
  careerProfileNavigation,
  getActiveCareerProfileItem,
  isCareerProfileItemActive,
} from "./career-profile-navigation";

describe("Career Profile navigation", () => {
  it("maps the approved labels to existing working routes", () => {
    expect(
      careerProfileNavigation.map(({ id, label, href }) => ({ id, label, href })),
    ).toEqual([
      { id: "overview", label: "Overview", href: "/knowledge" },
      { id: "add", label: "Add information", href: "/profile" },
      { id: "review", label: "Review changes", href: "/knowledge/review" },
      { id: "insights", label: "Insights", href: "/knowledge/insights" },
      {
        id: "attention",
        label: "Needs attention",
        href: "/knowledge/exceptions",
      },
    ]);
  });

  it.each([
    ["/knowledge", "overview"],
    ["/knowledge/insights", "insights"],
    ["/knowledge/insights/history", "insights"],
    ["/knowledge/review", "review"],
    ["/knowledge/review/pending", "review"],
    ["/knowledge/skills/review", "review"],
    ["/knowledge/exceptions", "attention"],
    ["/knowledge/exceptions/example", "attention"],
    ["/profile", "add"],
    ["/profile/import", "add"],
  ])("selects %s as %s", (pathname, expectedId) => {
    expect(getActiveCareerProfileItem(pathname)?.id).toBe(expectedId);
  });

  it("selects the most specific destination instead of the Overview parent", () => {
    expect(isCareerProfileItemActive("/knowledge/review", "/knowledge/review")).toBe(
      true,
    );
    expect(isCareerProfileItemActive("/knowledge/review", "/knowledge")).toBe(
      false,
    );
  });

  it("does not match unrelated routes or text-prefix collisions", () => {
    expect(getActiveCareerProfileItem("/jobs/new")).toBeNull();
    expect(getActiveCareerProfileItem("/knowledgeable")).toBeNull();
    expect(getActiveCareerProfileItem("/profiles")).toBeNull();
  });

  it("normalizes trailing slashes, query strings, and fragments", () => {
    expect(
      getActiveCareerProfileItem("/knowledge/insights/?from=home#patterns")?.id,
    ).toBe("insights");
  });
});
