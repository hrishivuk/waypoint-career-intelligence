import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = required("SUPABASE_TEST_URL");
const publishableKey = required("SUPABASE_TEST_PUBLISHABLE_KEY");
const serviceRoleKey = required("SUPABASE_TEST_SERVICE_ROLE_KEY");
if (process.env.SUPABASE_TEST_ALLOW_MUTATION !== "true") {
  throw new Error("Set SUPABASE_TEST_ALLOW_MUTATION=true only for a disposable migrated Supabase test project.");
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const password = `Wpt-${randomUUID()}-9a!`;
const runId = randomUUID();
const createdUsers: User[] = [];
let userA: TestActor;
let userB: TestActor;

describe("two-user RLS and Storage isolation", () => {
  beforeAll(async () => {
    userA = await createActor("a");
    userB = await createActor("b");
  });

  afterAll(async () => {
    await Promise.all(createdUsers.map(({ id }) => admin.auth.admin.deleteUser(id)));
  });

  it("isolates select, insert, update, delete, guessed relations, and private files", async () => {
    const sectionId = randomUUID();
    const ownInsert = await userA.client.from("application_kit_sections").insert({
      id: sectionId,
      user_id: userA.applicationUserId,
      section_type: "reusable",
      title: `Isolation ${runId}`,
      position: 9000,
    });
    expect(ownInsert.error).toBeNull();

    const foreignRead = await userB.client
      .from("application_kit_sections")
      .select("id")
      .eq("id", sectionId);
    expect(foreignRead.error).toBeNull();
    expect(foreignRead.data).toEqual([]);

    const foreignInsert = await userB.client.from("application_kit_sections").insert({
      user_id: userA.applicationUserId,
      section_type: "reusable",
      title: "Forbidden tenant write",
      position: 9001,
    });
    expect(foreignInsert.error).not.toBeNull();

    const crossTenantChild = await userB.client.from("application_kit_items").insert({
      user_id: userB.applicationUserId,
      section_id: sectionId,
      label: "Forbidden cross-tenant relation",
      value: "must not persist",
      position: 0,
    });
    expect(crossTenantChild.error).not.toBeNull();

    const foreignUpdate = await userB.client
      .from("application_kit_sections")
      .update({ title: "Compromised" })
      .eq("id", sectionId)
      .select("id");
    expect(foreignUpdate.error).toBeNull();
    expect(foreignUpdate.data).toEqual([]);

    const foreignDelete = await userB.client
      .from("application_kit_sections")
      .delete()
      .eq("id", sectionId)
      .select("id");
    expect(foreignDelete.error).toBeNull();
    expect(foreignDelete.data).toEqual([]);

    const stillOwned = await userA.client
      .from("application_kit_sections")
      .select("title")
      .eq("id", sectionId)
      .single();
    expect(stillOwned.error).toBeNull();
    expect(stillOwned.data?.title).toBe(`Isolation ${runId}`);

    const objectPath = `${userA.applicationUserId}/${randomUUID()}/isolation.txt`;
    const upload = await userA.client.storage
      .from("career-documents")
      .upload(objectPath, new Blob(["tenant-a"]), { contentType: "text/plain" });
    expect(upload.error).toBeNull();

    const ownSignedUrl = await userA.client.storage
      .from("career-documents")
      .createSignedUrl(objectPath, 30);
    expect(ownSignedUrl.error).toBeNull();
    expect(ownSignedUrl.data?.signedUrl).toBeTruthy();

    const foreignSignedUrl = await userB.client.storage
      .from("career-documents")
      .createSignedUrl(objectPath, 30);
    expect(foreignSignedUrl.error).not.toBeNull();

    const foreignPathUpload = await userB.client.storage
      .from("career-documents")
      .upload(`${userA.applicationUserId}/${randomUUID()}/forbidden.txt`, new Blob(["tenant-b"]));
    expect(foreignPathUpload.error).not.toBeNull();

    const removeOwn = await userA.client.storage.from("career-documents").remove([objectPath]);
    expect(removeOwn.error).toBeNull();
  });

  it("enforces and releases the configured per-user AI concurrency limit", async () => {
    const first = await admin.rpc("acquire_waypoint_ai_request_lease", {
      target_user_id: userA.applicationUserId,
      lease_seconds: 60,
    });
    const second = await admin.rpc("acquire_waypoint_ai_request_lease", {
      target_user_id: userA.applicationUserId,
      lease_seconds: 60,
    });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const rejected = await admin.rpc("acquire_waypoint_ai_request_lease", {
      target_user_id: userA.applicationUserId,
      lease_seconds: 60,
    });
    expect(rejected.error?.message).toContain("AI_CONCURRENCY_LIMIT");

    for (const lease of [first.data, second.data]) {
      const released = await admin.rpc("release_waypoint_ai_request_lease", {
        target_user_id: userA.applicationUserId,
        target_lease_id: lease,
      });
      expect(released.error).toBeNull();
    }
    const reacquired = await admin.rpc("acquire_waypoint_ai_request_lease", {
      target_user_id: userA.applicationUserId,
      lease_seconds: 60,
    });
    expect(reacquired.error).toBeNull();
    await admin.rpc("release_waypoint_ai_request_lease", {
      target_user_id: userA.applicationUserId,
      target_lease_id: reacquired.data,
    });
  });
});

interface TestActor {
  applicationUserId: string;
  client: SupabaseClient;
}

async function createActor(label: string): Promise<TestActor> {
  const email = `waypoint-rls-${label}-${runId}@example.invalid`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("Test user creation failed.");
  createdUsers.push(created.data.user);

  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  const identity = await client
    .from("prototype_users")
    .select("id")
    .eq("auth_user_id", created.data.user.id)
    .single();
  if (identity.error || !identity.data) throw identity.error ?? new Error("Provisioning trigger did not create an identity.");
  return { applicationUserId: identity.data.id, client };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the destructive integration suite.`);
  return value;
}
