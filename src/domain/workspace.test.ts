import { describe, expect, it } from "vitest";

import {
  isWorkspaceMode,
  workspaceAllowsPersonalData,
} from "./workspace";

describe("workspace boundaries", () => {
  it("recognises only supported workspace modes", () => {
    expect(isWorkspaceMode("personal")).toBe(true);
    expect(isWorkspaceMode("demo")).toBe(true);
    expect(isWorkspaceMode("admin")).toBe(false);
    expect(isWorkspaceMode(null)).toBe(false);
  });

  it("never permits personal data access from demo mode", () => {
    expect(workspaceAllowsPersonalData("demo")).toBe(false);
    expect(workspaceAllowsPersonalData("personal")).toBe(true);
  });
});
