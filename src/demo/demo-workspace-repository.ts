import { demoWorkspace, type DemoWorkspace } from "./fixtures/workspace";

export interface DemoWorkspaceRepository {
  load(): Promise<DemoWorkspace>;
}

export class FixtureDemoWorkspaceRepository implements DemoWorkspaceRepository {
  async load() {
    return demoWorkspace;
  }
}

