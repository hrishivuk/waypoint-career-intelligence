import { describe, expect, it } from "vitest";

import { FixtureDemoWorkspaceRepository } from "./demo-workspace-repository";

describe("FixtureDemoWorkspaceRepository", () => {
  it("returns a complete deterministic workspace without provider access", async () => {
    const workspace = await new FixtureDemoWorkspaceRepository().load();
    expect(workspace.candidate.name).toBe("Jordan Lee");
    expect(workspace.cvs).toHaveLength(2);
    expect(workspace.job.bestCv.name).toBe("Frontend Engineer CV");
  });
});

