import type { Metadata } from "next";

import { KnowledgeLibrary } from "@/components/knowledge-library";
import { PageContainer, PageHeader } from "@/components/ui";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";
import { loadKnowledgeLibrary } from "@/infrastructure/persistence/knowledge-library/supabase-knowledge-library";

export const metadata: Metadata = {
  title: "Profile insights",
  description: "Review personal patterns and context stored by Waypoint.",
};

export const dynamic = "force-dynamic";

export default async function ProfileInsightsPage() {
  const { actor, client } = await requireAuthenticatedContext();
  const sections = await loadKnowledgeLibrary(client, actor.userId, [
    "career-modes",
    "preferences",
    "decision-policies",
    "capabilities",
    "history",
    "temporary",
    "uncertainties",
  ]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Career knowledge"
        title="Profile insights"
        description={
          <>
          Historical patterns, temporary circumstances and unresolved
          questions live here. They can inform advice when relevant, but they
          do not clutter the everyday job-decision view.
          </>
        }
      />
      <KnowledgeLibrary sections={sections} />
    </PageContainer>
  );
}
