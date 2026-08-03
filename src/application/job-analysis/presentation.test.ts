import { describe, expect, it } from "vitest";

import {
  formatJobAnalysisDate,
  formatJobAnalysisScore,
  getJobDisplayIdentity,
  getRecommendationPresentation,
  isUuid,
} from "./presentation";

describe("job recommendation presentation", () => {
  it.each([
    ["apply", "Worth applying", "success"],
    ["investigate", "Investigate first", "warning"],
    ["skip", "Probably skip", "danger"],
  ] as const)("maps %s to a user-facing label and tone", (value, label, tone) => {
    expect(getRecommendationPresentation(value)).toMatchObject({ label, tone });
  });

  it("provides an explanation in addition to a color-independent label", () => {
    expect(getRecommendationPresentation("investigate").description).toContain(
      "unknowns",
    );
  });
});

describe("job analysis date formatting", () => {
  it("formats a valid date deterministically", () => {
    expect(
      formatJobAnalysisDate("2026-08-03T23:30:00.000Z", {
        locale: "en-GB",
        timeZone: "UTC",
      }),
    ).toBe("3 Aug 2026");
  });

  it.each([null, undefined, "", "not-a-date"])(
    "uses a safe fallback for %s",
    (value) => {
      expect(formatJobAnalysisDate(value)).toBe("Date unavailable");
    },
  );

  it("uses a safe fallback for an invalid time zone", () => {
    expect(
      formatJobAnalysisDate("2026-08-03T12:00:00.000Z", {
        timeZone: "Not/A_Time_Zone",
      }),
    ).toBe("Date unavailable");
  });
});

describe("job analysis score formatting", () => {
  it.each([
    [0, "0/100"],
    [72, "72/100"],
    [72.6, "73/100"],
    [100, "100/100"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatJobAnalysisScore(value)).toBe(expected);
  });

  it.each([null, undefined, "72", Number.NaN, Infinity, -1, 101])(
    "does not present invalid score %s as evidence",
    (value) => {
      expect(formatJobAnalysisScore(value)).toBe("Score unavailable");
    },
  );
});

describe("job route identifiers", () => {
  it.each([
    "550e8400-e29b-41d4-a716-446655440000",
    "550E8400-E29B-41D4-A716-446655440000",
  ])("accepts canonical UUID %s", (value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    null,
    undefined,
    "",
    "550e8400e29b41d4a716446655440000",
    "00000000-0000-0000-0000-000000000000",
    "../../../settings",
  ])("rejects invalid identifier %s", (value) => {
    expect(isUuid(value)).toBe(false);
  });
});

describe("job display identity", () => {
  it("trims stored title and company values", () => {
    expect(
      getJobDisplayIdentity({
        title: "  Product Designer  ",
        company: "  Acme  ",
      }),
    ).toEqual({ title: "Product Designer", company: "Acme" });
  });

  it.each([
    [{ title: null, company: null }],
    [{ title: "   ", company: "\n" }],
    [{}],
  ])("uses honest fallbacks for missing identity values", (input) => {
    expect(getJobDisplayIdentity(input)).toEqual({
      title: "Untitled role",
      company: "Company not identified",
    });
  });
});
