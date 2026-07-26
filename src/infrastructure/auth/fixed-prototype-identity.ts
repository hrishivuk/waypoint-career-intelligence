import "server-only";

import { getServerEnv } from "@/config/env";

export interface Actor {
  userId: string;
  authenticationMethod: "fixed-prototype";
}

export interface IdentityProvider {
  getActor(): Promise<Actor>;
}

export class FixedPrototypeIdentityProvider implements IdentityProvider {
  async getActor(): Promise<Actor> {
    return {
      userId: getServerEnv().PROTOTYPE_USER_ID,
      authenticationMethod: "fixed-prototype",
    };
  }
}
