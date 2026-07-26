export const workspaceModes = ["personal", "demo"] as const;
export type WorkspaceMode = (typeof workspaceModes)[number];
export const WORKSPACE_COOKIE = "waypoint_workspace";

export function isWorkspaceMode(value: unknown): value is WorkspaceMode {
  return workspaceModes.includes(value as WorkspaceMode);
}

export function workspaceAllowsPersonalData(mode: WorkspaceMode | null) {
  return mode !== "demo";
}
