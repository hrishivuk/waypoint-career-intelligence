import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = join(process.cwd(), "supabase/migrations");
const read = (name: string) => readFileSync(join(migrations, name), "utf8");

describe("public multi-user schema contract", () => {
  it("binds application-kit items to sections owned by the same user", () => {
    const sql = read("202608020004_tenant_relational_integrity.sql");
    expect(sql).toContain("foreign key (section_id, user_id)");
    expect(sql).toContain("application_kit_sections(id, user_id)");
  });

  it("binds CV claims and sections to the same document", () => {
    const sql = read("202608020004_tenant_relational_integrity.sql");
    expect(sql).toContain("foreign key (section_id, cv_document_id)");
    expect(sql).toContain("cv_sections_v2(id, cv_document_id)");
  });

  it("prevents authenticated clients from deleting or rebinding identities", () => {
    const sql = read("202608020004_tenant_relational_integrity.sql");
    expect(sql).toContain("revoke insert, delete, update on table public.prototype_users");
    expect(sql).toContain("grant update (display_name)");
  });

  it("allows narrative writes through owner RLS instead of service role", () => {
    const sql = read("202608020005_authenticated_narrative_workflows.sql");
    expect(sql).toContain("career_narrative_imports");
    expect(sql).toContain("career_narrative_candidates");
    expect(sql).toContain("to authenticated");
  });
});
