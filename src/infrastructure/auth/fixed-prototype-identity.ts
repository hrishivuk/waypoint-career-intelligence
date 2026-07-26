import "server-only";

import { getServerEnv } from "@/config/env";
import { requirePersonalWorkspace } from "@/infrastructure/workspace/server-workspace";

export interface Actor {
  userId: string;
  authenticationMethod: "fixed-prototype";
}

export interface IdentityProvider {
  getActor(): Promise<Actor>;
}

export class FixedPrototypeIdentityProvider implements IdentityProvider {
  async getActor(): Promise<Actor> {
    await requirePersonalWorkspace();
    return {
      userId: getServerEnv().PROTOTYPE_USER_ID,
      authenticationMethod: "fixed-prototype",
    };
  }
}
