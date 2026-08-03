import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { strFromU8, unzipSync } from "fflate";

vi.mock("server-only", () => ({}));

import { createAccountArchive, deleteAccountData } from "./account-lifecycle";

describe("account export archive", () => {
  it("contains structured JSON and sanitised source-document filenames", () => {
    const exported = {
      format: "waypoint-account-export",
      version: 1,
      exportedAt: "2026-08-03T12:00:00.000Z",
      account: { authUserId: "auth-1", email: "user@example.com", profile: { id: "user-1" } },
      sourceDocuments: [],
      records: {},
    } as never;
    const archive = unzipSync(createAccountArchive(exported, [{
      id: "cv-1",
      filename: "../../private/resume.pdf",
      bytes: new Uint8Array([1, 2, 3]),
    }]));

    expect(JSON.parse(strFromU8(archive["account.json"]))).toMatchObject({
      format: "waypoint-account-export",
      account: { email: "user@example.com" },
    });
    const sourceName = Object.keys(archive).find((name) => name.startsWith("source-documents/"));
    expect(sourceName).toContain("cv-1-");
    expect(sourceName).not.toContain("..");
  });
});

describe("deleteAccountData", () => {
  it("removes nested storage objects before application data and auth identity", async () => {
    const events: string[] = [];
    const list = vi.fn(async (prefix: string) => {
      if (prefix === "profile-1") {
        return { data: [{ id: null, metadata: null, name: "cv-v2" }], error: null };
      }
      return {
        data: [{ id: "object-1", metadata: { size: 10 }, name: "resume.pdf" }],
        error: null,
      };
    });
    const remove = vi.fn(async (paths: string[]) => {
      events.push(`storage:${paths.join(",")}`);
      return { error: null };
    });
    const deleteQuery: {
      eq: ReturnType<typeof vi.fn>;
      then: (resolve: (value: { error: null }) => unknown) => Promise<unknown>;
    } = {
      eq: vi.fn(),
      then(resolve: (value: { error: null }) => unknown) {
        events.push("profile");
        return Promise.resolve(resolve({ error: null }));
      },
    };
    deleteQuery.eq.mockImplementation(() => deleteQuery);
    const deleteUser = vi.fn(async () => {
      events.push("auth");
      return { error: null };
    });
    const admin = {
      storage: { from: () => ({ list, remove }) },
      from: () => ({ delete: () => deleteQuery }),
      auth: { admin: { deleteUser } },
    } as unknown as SupabaseClient;

    await deleteAccountData(admin, { userId: "profile-1", authUserId: "auth-1" });

    expect(remove).toHaveBeenCalledWith(["profile-1/cv-v2/resume.pdf"]);
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(1, "id", "profile-1");
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(2, "auth_user_id", "auth-1");
    expect(deleteUser).toHaveBeenCalledWith("auth-1");
    expect(events).toEqual([
      "storage:profile-1/cv-v2/resume.pdf",
      "profile",
      "auth",
    ]);
  });

  it("stops before database deletion when storage cleanup fails", async () => {
    const deleteRow = vi.fn();
    const admin = {
      storage: {
        from: () => ({
          list: async () => ({ data: null, error: new Error("storage unavailable") }),
          remove: vi.fn(),
        }),
      },
      from: () => ({ delete: deleteRow }),
      auth: { admin: { deleteUser: vi.fn() } },
    } as unknown as SupabaseClient;

    await expect(
      deleteAccountData(admin, { userId: "profile-1", authUserId: "auth-1" }),
    ).rejects.toThrow("storage unavailable");
    expect(deleteRow).not.toHaveBeenCalled();
  });
});
