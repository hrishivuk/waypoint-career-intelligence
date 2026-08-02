import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createSupabaseAuthServerClient } from "./supabase-auth-server";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AccountProvisioningRequiredError extends Error {
  constructor() {
    super("Your Waypoint account is still being prepared.");
    this.name = "AccountProvisioningRequiredError";
  }
}

export interface AuthenticatedActor {
  userId: string;
  authUserId: string;
  email: string | null;
  authenticationMethod: "supabase-auth";
}

export interface AuthenticatedRequestContext {
  actor: AuthenticatedActor;
  /** Request-scoped client carrying the user's session. RLS is enforced. */
  client: SupabaseClient;
  authUser: User;
}

/**
 * Resolves the current actor without using the service-role client.
 *
 * All ordinary user-data operations should start here and continue with the
 * returned request-scoped client so PostgreSQL RLS remains the default
 * authorization boundary.
 */
export async function requireAuthenticatedContext(): Promise<AuthenticatedRequestContext> {
  const client = await createSupabaseAuthServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthenticationRequiredError();

  const { data: initialProfile, error: profileError } = await client
    .from("prototype_users")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  let profile = initialProfile;
  if (!profile) {
    const { error: bootstrapError } = await client.rpc(
      "bootstrap_current_waypoint_user",
    );
    if (bootstrapError) throw new AccountProvisioningRequiredError();
    const retried = await client
      .from("prototype_users")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();
    if (retried.error) throw retried.error;
    profile = retried.data;
  }
  if (!profile) throw new AccountProvisioningRequiredError();

  return {
    actor: {
      userId: String(profile.id),
      authUserId: data.user.id,
      email: data.user.email ?? null,
      authenticationMethod: "supabase-auth",
    },
    client,
    authUser: data.user,
  };
}

export class SupabaseIdentityProvider {
  async getActor(): Promise<AuthenticatedActor> {
    return (await requireAuthenticatedContext()).actor;
  }
}
