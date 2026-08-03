import type { Metadata } from "next";
import Link from "next/link";

import { SavedJobsList } from "@/components/jobs/saved-jobs-list";
import { buttonVariants } from "@/components/ui/button-variants";
import { PageContainer, PageHeader } from "@/components/ui";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";
import { listSavedJobAnalyses } from "@/infrastructure/job-analysis/saved-job-analyses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Review saved job analyses and continue career decisions.",
};

export default async function JobsPage() {
  const { actor, client } = await requireAuthenticatedContext();
  const analyses = await listSavedJobAnalyses(client, actor.userId);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Job decisions"
        title="Saved job analyses"
        description="Return to previous decisions, review the evidence behind them, or analyse another opportunity."
        actions={
          <Link href="/jobs/new" className={buttonVariants()}>
            Analyse a new job
          </Link>
        }
      />
      <SavedJobsList analyses={analyses} />
    </PageContainer>
  );
}
