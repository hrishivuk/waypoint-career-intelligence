import type { Metadata } from "next";
import Link from "next/link";

import { KnowledgeLibrary } from "@/components/knowledge-library";
import { buttonStyles, PageContainer, PageHeader } from "@/components/ui";
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
    <PageContainer>
      <PageHeader
        eyebrow="Career knowledge"
        title="What Waypoint knows about your work"
        description={
          <>
          Start with your categorized skills and self-assessed levels, then
          review the projects, experience and stable facts that support job
          recommendations.
          </>
        }
        actions={
          <>
          <Link
            href="/knowledge/insights"
            className={buttonStyles.secondary}
          >
            Profile insights
          </Link>
          <Link
            href="/knowledge/exceptions"
            className={buttonStyles.secondary}
          >
            Extraction exceptions
          </Link>
          <Link
            href="/profile"
            className={buttonStyles.secondary}
          >
            Add a fact
          </Link>
          </>
        }
      />
      <KnowledgeLibrary sections={sections} />
    </PageContainer>
  );
}
