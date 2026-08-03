import type { Metadata } from "next";
import Link from "next/link";

import { KnowledgeLibrary } from "@/components/knowledge-library";
import { CareerProfileSectionHeader } from "@/components/profile/career-profile-section-header";
import { buttonStyles } from "@/components/ui";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";
import { loadKnowledgeLibrary } from "@/infrastructure/persistence/knowledge-library/supabase-knowledge-library";

export const metadata: Metadata = {
  title: "Job decision knowledge",
  description: "See the trusted knowledge Waypoint uses to assess jobs.",
};

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const { actor, client } = await requireAuthenticatedContext();
  const sections = await loadKnowledgeLibrary(client, actor.userId, [
    "skills",
    "competencies",
    "projects",
    "evidence",
    "stable-facts",
  ]);

  return (
    <>
      <CareerProfileSectionHeader
        title="Your reviewed career evidence"
        description={
          <>
          This is the information Waypoint can use when evaluating jobs and
          comparing CV coverage. You remain in control of every confirmed fact.
          </>
        }
        actions={
          <>
          <Link
            href="/profile"
            className={buttonStyles.primary}
          >
            Add information
          </Link>
          </>
        }
      />
      <KnowledgeLibrary sections={sections} />
    </>
  );
}
