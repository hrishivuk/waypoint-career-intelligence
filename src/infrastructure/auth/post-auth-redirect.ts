import type { SupabaseClient } from "@supabase/supabase-js";

import { safeAuthRedirect } from "./auth-redirect";

export async function resolvePostAuthRedirect(
  client: SupabaseClient,
  requested: string | null | undefined,
) {
  const fallback = safeAuthRedirect(requested);
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) return "/login";

  let profile = await client
    .from("prototype_users")
    .select("id")
    .eq("auth_user_id", user.data.user.id)
    .maybeSingle();
  if (profile.error) return "/onboarding";
  if (!profile.data) {
    const bootstrapped = await client.rpc("bootstrap_current_waypoint_user");
    if (bootstrapped.error) return "/onboarding";
    profile = await client
      .from("prototype_users")
      .select("id")
      .eq("auth_user_id", user.data.user.id)
      .maybeSingle();
  }
  if (profile.error || !profile.data) return "/onboarding";

  const onboarding = await client
    .from("user_onboarding_state")
    .select("completed_at")
    .eq("user_id", profile.data.id)
    .maybeSingle();
  return postAuthDestination(fallback, onboarding.data?.completed_at);
}

export function postAuthDestination(
  requested: string,
  completedAt: string | null | undefined,
) {
  if (!completedAt && !requested.startsWith("/onboarding")) return "/onboarding";
  return requested;
}
