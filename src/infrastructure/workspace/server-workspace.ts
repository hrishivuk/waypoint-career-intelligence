import "server-only";

import { cookies } from "next/headers";

import {
  isWorkspaceMode,
  workspaceAllowsPersonalData,
  WORKSPACE_COOKIE,
  type WorkspaceMode,
} from "@/domain/workspace";

export async function getWorkspaceMode(): Promise<WorkspaceMode | null> {
  const value = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  return isWorkspaceMode(value) ? value : null;
}

export class PersonalWorkspaceRequiredError extends Error {
  constructor() {
    super("Personal workspace authentication is required.");
    this.name = "PersonalWorkspaceRequiredError";
  }
}

export async function requirePersonalWorkspace() {
  const mode = await getWorkspaceMode();
  if (!workspaceAllowsPersonalData(mode)) {
    throw new PersonalWorkspaceRequiredError();
  }
  return mode;
}
