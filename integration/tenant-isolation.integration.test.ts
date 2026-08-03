import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = requiredOne("SUPABASE_TEST_URL", "SUPABASE_URL");
const publishableKey = requiredOne(
  "SUPABASE_TEST_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);
const serviceRoleKey = requiredOne(
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
);
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

  it("atomically synchronizes requirement importance without crossing tenants", async () => {
    const jobId = randomUUID();
    const analysisId = randomUUID();
    const malformedAnalysisId = randomUUID();
    const requirementId = randomUUID();
    const requirement = {
      position: 0,
      text: "Five years of TypeScript experience",
      kind: "experience",
      required: true,
      match: "partial",
      score: 60,
      explanation: "Some supporting evidence exists.",
      evidence: [],
      criticality: "important",
    };

    const jobInsert = await userA.client.from("jobs").insert({
      id: jobId,
      user_id: userA.applicationUserId,
      title: "Atomic update test",
      description_text: requirement.text,
    });
    expect(jobInsert.error).toBeNull();

    const requirementInsert = await userA.client.from("job_requirements").insert({
      id: requirementId,
      user_id: userA.applicationUserId,
      job_id: jobId,
      position: 0,
      kind: "experience",
      requirement_text: requirement.text,
      is_required: true,
      metadata: { priority: "required" },
      criticality: "important",
    });
    expect(requirementInsert.error).toBeNull();

    const analysisBase = {
      user_id: userA.applicationUserId,
      job_id: jobId,
      recommendation: "investigate",
      overall_score: 60,
      confidence: 0.6,
      summary: "Integration fixture",
      status: "completed",
      completed_at: new Date().toISOString(),
      model_id: "integration-test",
      prompt_version: "integration-test",
      schema_version: "job-analysis-v2",
      scoring_policy_version: "integration-test",
    };
    const analysesInsert = await userA.client.from("analyses").insert([
      { id: analysisId, ...analysisBase, result: { requirements: [requirement] } },
      { id: malformedAnalysisId, ...analysisBase, result: { requirements: [] } },
    ]);
    expect(analysesInsert.error).toBeNull();

    const foreignUpdate = await userB.client.rpc(
      "update_job_requirement_criticality_v1",
      {
        target_analysis_id: analysisId,
        target_position: 0,
        target_criticality: "bonus",
      },
    );
    expect(foreignUpdate.error).toBeNull();
    expect(foreignUpdate.data).toBe(false);

    const ownUpdate = await userA.client.rpc("update_job_requirement_criticality_v1", {
      target_analysis_id: analysisId,
      target_position: 0,
      target_criticality: "preferred",
    });
    expect(ownUpdate.error).toBeNull();
    expect(ownUpdate.data).toBe(true);

    const [storedRequirement, storedAnalysis] = await Promise.all([
      userA.client
        .from("job_requirements")
        .select("criticality,is_required,metadata")
        .eq("id", requirementId)
        .single(),
      userA.client.from("analyses").select("result").eq("id", analysisId).single(),
    ]);
    expect(storedRequirement.error).toBeNull();
    expect(storedRequirement.data).toMatchObject({
      criticality: "preferred",
      is_required: false,
      metadata: { priority: "preferred", corrected_by_user: true },
    });
    expect(storedAnalysis.error).toBeNull();
    expect(storedAnalysis.data?.result).toMatchObject({
      requiresReanalysis: true,
      reanalysisReason: "requirement_criticality_changed",
      requirements: [{ criticality: "preferred", required: false }],
    });

    const malformedUpdate = await userA.client.rpc(
      "update_job_requirement_criticality_v1",
      {
        target_analysis_id: malformedAnalysisId,
        target_position: 0,
        target_criticality: "bonus",
      },
    );
    expect(malformedUpdate.error?.code).toBe("P0001");

    const afterRollback = await userA.client
      .from("job_requirements")
      .select("criticality")
      .eq("id", requirementId)
      .single();
    expect(afterRollback.data?.criticality).toBe("preferred");
  });

  it("atomically reviews and activates only the complete owned narrative decision set", async () => {
    const importId = randomUUID();
    const acceptedId = randomUUID();
    const rejectedId = randomUUID();
    const importInsert = await userA.client.from("career_narrative_imports").insert({
      id: importId,
      user_id: userA.applicationUserId,
      source_text: `Integration narrative ${"evidence ".repeat(12)}`,
      source_hash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      status: "staged",
    });
    expect(importInsert.error).toBeNull();

    const candidateInsert = await userA.client
      .from("career_narrative_candidates")
      .insert([
        {
          id: acceptedId,
          user_id: userA.applicationUserId,
          import_id: importId,
          record_type: "skill",
          title: "TypeScript",
          statement: "Uses TypeScript in production frontend applications.",
          source_block_id: "integration-block-1",
          source_excerpt: "Uses TypeScript in production frontend applications.",
          confidence: 0.9,
          display_order: 0,
          reconciliation: "new",
          canonical_key: `typescript-${runId.replaceAll("-", "")}`,
        },
        {
          id: rejectedId,
          user_id: userA.applicationUserId,
          import_id: importId,
          record_type: "skill",
          title: "Unverified skill",
          statement: "This proposed skill should be rejected.",
          source_block_id: "integration-block-2",
          source_excerpt: "This proposed skill should be rejected.",
          confidence: 0.5,
          display_order: 1,
          reconciliation: "new",
          canonical_key: `unverified-${runId.replaceAll("-", "")}`,
        },
      ]);
    expect(candidateInsert.error).toBeNull();

    const incomplete = await userA.client.rpc(
      "review_and_activate_career_narrative_import_v1",
      {
        p_import_id: importId,
        p_decisions: [{ id: acceptedId, decision: "confirmed" }],
      },
    );
    expect(incomplete.error?.code).toBe("P0001");
    const afterMismatch = await userA.client
      .from("career_narrative_candidates")
      .select("decision")
      .eq("import_id", importId)
      .order("display_order");
    expect(afterMismatch.data?.map(({ decision }) => decision)).toEqual([
      "pending",
      "pending",
    ]);

    const foreign = await userB.client.rpc(
      "review_and_activate_career_narrative_import_v1",
      {
        p_import_id: importId,
        p_decisions: [
          { id: acceptedId, decision: "confirmed" },
          { id: rejectedId, decision: "rejected" },
        ],
      },
    );
    expect(foreign.error?.code).toBe("P0002");

    const activated = await userA.client.rpc(
      "review_and_activate_career_narrative_import_v1",
      {
        p_import_id: importId,
        p_decisions: [
          { id: acceptedId, decision: "confirmed" },
          { id: rejectedId, decision: "rejected" },
        ],
      },
    );
    expect(activated.error).toBeNull();
    expect(activated.data).toBe(1);

    const [storedImport, storedCandidates, storedProfile] = await Promise.all([
      userA.client
        .from("career_narrative_imports")
        .select("status")
        .eq("id", importId)
        .single(),
      userA.client
        .from("career_narrative_candidates")
        .select("decision")
        .eq("import_id", importId)
        .order("display_order"),
      userA.client
        .from("master_profile_records")
        .select("source_candidate_id")
        .eq("source_import_id", importId),
    ]);
    expect(storedImport.data?.status).toBe("activated");
    expect(storedCandidates.data?.map(({ decision }) => decision)).toEqual([
      "confirmed",
      "rejected",
    ]);
    expect(storedProfile.data).toEqual([{ source_candidate_id: acceptedId }]);
  });

  it("atomically stages complete narrative reviews and preserves the prior review on failure", async () => {
    const sourceText = `Atomic narrative staging ${"supported evidence ".repeat(8)}`;
    const firstHash = "a".repeat(64);
    const failedHash = "b".repeat(64);
    const secondHash = "c".repeat(64);
    const validCandidate = {
      record_type: "skill",
      title: "React",
      statement: "Builds production interfaces with React.",
      structured_data: { proficiency: "working" },
      source_block_id: "atomic-stage-1",
      source_excerpt: "Builds production interfaces with React.",
      confidence: 0.9,
      reconciliation: "new",
      target_record_id: null,
      canonical_key: `react-${runId.replaceAll("-", "")}`,
      display_order: 0,
    };

    const foreignStage = await userB.client.rpc(
      "stage_career_narrative_import_v1",
      {
        p_user_id: userA.applicationUserId,
        p_source_text: sourceText,
        p_source_hash: firstHash,
        p_model_metadata: {},
        p_candidates: [validCandidate],
      },
    );
    expect(foreignStage.error?.code).toBe("P0002");

    const firstStage = await userA.client.rpc("stage_career_narrative_import_v1", {
      p_user_id: userA.applicationUserId,
      p_source_text: sourceText,
      p_source_hash: firstHash,
      p_model_metadata: {},
      p_candidates: [validCandidate],
    });
    expect(firstStage.error).toBeNull();
    expect(firstStage.data).toBeTruthy();

    const failedStage = await userA.client.rpc("stage_career_narrative_import_v1", {
      p_user_id: userA.applicationUserId,
      p_source_text: `${sourceText} failed candidate`,
      p_source_hash: failedHash,
      p_model_metadata: {},
      p_candidates: [{ ...validCandidate, title: "", canonical_key: "invalid" }],
    });
    expect(failedStage.error).not.toBeNull();
    const firstAfterFailure = await userA.client
      .from("career_narrative_imports")
      .select("status")
      .eq("id", firstStage.data)
      .single();
    expect(firstAfterFailure.data?.status).toBe("staged");

    const secondStage = await userA.client.rpc("stage_career_narrative_import_v1", {
      p_user_id: userA.applicationUserId,
      p_source_text: `${sourceText} second complete review`,
      p_source_hash: secondHash,
      p_model_metadata: {},
      p_candidates: [{ ...validCandidate, canonical_key: `react-second-${runId.replaceAll("-", "")}` }],
    });
    expect(secondStage.error).toBeNull();
    const [firstStored, secondCandidates] = await Promise.all([
      userA.client
        .from("career_narrative_imports")
        .select("status")
        .eq("id", firstStage.data)
        .single(),
      userA.client
        .from("career_narrative_candidates")
        .select("id")
        .eq("import_id", secondStage.data),
    ]);
    expect(firstStored.data?.status).toBe("superseded");
    expect(secondCandidates.data).toHaveLength(1);
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

function requiredOne(primary: string, fallback: string): string {
  const value = process.env[primary]?.trim() || process.env[fallback]?.trim();
  if (!value) {
    throw new Error(`${primary} (or ${fallback}) is required for the destructive integration suite.`);
  }
  return value;
}
