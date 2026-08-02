import { describe, expect, it } from "vitest";

import { safeAuthRedirect } from "./auth-redirect";

describe("safeAuthRedirect", () => {
  it.each([undefined, null, "", "https://evil.test", "//evil.test", "javascript:alert(1)"])(
    "falls back for unsafe value %s",
    (value) => expect(safeAuthRedirect(value)).toBe("/"),
  );

  it("preserves a local path, query, and fragment", () => {
    expect(safeAuthRedirect("/profile?from=auth#facts")).toBe("/profile?from=auth#facts");
  });
});
