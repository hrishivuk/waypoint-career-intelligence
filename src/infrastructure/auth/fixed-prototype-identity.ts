import "server-only";

import { getServerEnv } from "@/config/env";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";
import { requirePersonalWorkspace } from "@/infrastructure/workspace/server-workspace";
import {
  createSupabaseAuthServerClient,
  isSupabaseAuthConfigured,
} from "./supabase-auth-server";

export interface Actor {
  userId: string;
  authenticationMethod: "fixed-prototype" | "supabase-auth";
}

export interface IdentityProvider {
  getActor(): Promise<Actor>;
}

export class FixedPrototypeIdentityProvider implements IdentityProvider {
  async getActor(): Promise<Actor> {
    await requirePersonalWorkspace();
    if (isSupabaseAuthConfigured()) {
      const auth = await createSupabaseAuthServerClient();
      const { data, error } = await auth.auth.getUser();
      if (error || !data.user) throw new Error("Authentication required.");
      const profile = await getSupabaseServerClient()
        .from("prototype_users")
        .select("id")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();
      if (profile.error) throw profile.error;
      if (!profile.data) {
        throw new Error("This account is not linked to a Waypoint profile.");
      }
      return {
        userId: String(profile.data.id),
        authenticationMethod: "supabase-auth",
      };
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("Personal authentication is not configured.");
    }
    return {
      userId: getServerEnv().PROTOTYPE_USER_ID,
      authenticationMethod: "fixed-prototype",
    };
  }
}
