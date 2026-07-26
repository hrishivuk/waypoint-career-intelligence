import { describe, expect, it } from "vitest";

import { demoCandidate } from "./candidate";

describe("public demo fixtures", () => {
  it("contain the fictional identity and no known personal-source markers", () => {
    const serialized = JSON.stringify(demoCandidate).toLowerCase();
    expect(demoCandidate.name).toBe("Jordan Lee");
    for (const forbidden of [
      "hrishikesh",
      "hrishivuk",
      "dublin",
      "stamp 1g",
      "experion",
      "pixel forge",
      "coachcanvas",
      "@gmail.com",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
