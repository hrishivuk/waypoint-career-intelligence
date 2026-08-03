import "server-only";

import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export type UsageKind = "ai_requests" | "imports" | "uploads";

export class UsageLimitExceededError extends Error {
  constructor(kind: UsageKind) {
    super(`Your daily ${kind.replace("_", " ")} limit has been reached.`);
    this.name = "UsageLimitExceededError";
  }
}

export class AiConcurrencyLimitExceededError extends Error {
  constructor() {
    super("Too many AI requests are already running. Wait for one to finish and try again.");
    this.name = "AiConcurrencyLimitExceededError";
  }
}

export async function consumeUsage(userId: string, kind: UsageKind, amount = 1) {
  const { error } = await getSupabaseServerClient().rpc(
    "consume_waypoint_daily_usage",
    { target_user_id: userId, usage_kind: kind, amount },
  );
  if (!error) return;
  if (error.code === "P0001") throw new UsageLimitExceededError(kind);
  throw error;
}

export async function withAiUsageLease<T>(userId: string, action: () => Promise<T>) {
  const client = getSupabaseServerClient();
  const acquired = await client.rpc("acquire_waypoint_ai_request_lease", {
    target_user_id: userId,
    lease_seconds: 300,
  });
  if (acquired.error) {
    if (acquired.error.code === "P0001" && acquired.error.message.includes("AI_CONCURRENCY_LIMIT")) {
      throw new AiConcurrencyLimitExceededError();
    }
    throw acquired.error;
  }
  const leaseId = String(acquired.data);
  try {
    await consumeUsage(userId, "ai_requests");
    return await action();
  } finally {
    const released = await client.rpc("release_waypoint_ai_request_lease", {
      target_user_id: userId,
      target_lease_id: leaseId,
    });
    if (released.error) console.error("Unable to release AI request lease.");
  }
}

export async function assertStorageAllowance(userId: string, incomingBytes: number) {
  const client = getSupabaseServerClient();
  const [{ data: limits, error: limitError }, { data: documents, error: documentError }] =
    await Promise.all([
      client.from("user_usage_limits").select("storage_bytes").eq("user_id", userId).single(),
      client.from("cv_documents_v2").select("byte_size").eq("user_id", userId),
    ]);
  if (limitError) throw limitError;
  if (documentError) throw documentError;
  const used = (documents ?? []).reduce((sum, row) => sum + Number(row.byte_size || 0), 0);
  if (used + incomingBytes > Number(limits.storage_bytes)) {
    throw new Error("Your CV storage allowance would be exceeded.");
  }
}
