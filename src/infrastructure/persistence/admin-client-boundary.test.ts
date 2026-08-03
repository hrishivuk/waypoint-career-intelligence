import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "src/app");
const allowedElevatedRoutes = new Set([
  "api/v1/account/route.ts",
  "api/v1/knowledge/rebuild/archive/route.ts",
  "api/v1/knowledge/skills/review/project/route.ts",
  "api/v1/settings/ai-credentials/route.ts",
]);

describe("elevated Supabase client boundary", () => {
  it("keeps service-role access out of ordinary application routes", () => {
    const elevated = walk(appRoot)
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => readFileSync(path, "utf8").includes("getSupabaseServerClient"))
      .map((path) => relative(appRoot, path));

    expect(elevated.sort()).toEqual([...allowedElevatedRoutes].sort());
  });

  it("documents why each elevated route is allowed", () => {
    const expectedOperations = new Map([
      ["api/v1/account/route.ts", "deleteAccountData"],
      ["api/v1/knowledge/rebuild/archive/route.ts", "archive_waypoint_knowledge_v1"],
      ["api/v1/knowledge/skills/review/project/route.ts", "project_skill_model_review"],
      ["api/v1/settings/ai-credentials/route.ts", "UserCredentialRepository"],
    ]);
    for (const [path, operation] of expectedOperations) {
      expect(readFileSync(join(appRoot, path), "utf8")).toContain(operation);
    }
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

