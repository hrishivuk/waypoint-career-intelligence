import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isUuid } from "@/application/job-analysis";
import { SavedJobDetail } from "@/components/jobs/saved-job-detail";
import { PageContainer } from "@/components/ui";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";
import { getSavedJobAnalysis } from "@/infrastructure/job-analysis/saved-job-analyses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved job analysis",
  description: "Inspect a saved Waypoint job decision and its supporting evidence.",
};

export default async function SavedJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { actor, client } = await requireAuthenticatedContext();
  const detail = await getSavedJobAnalysis(client, actor.userId, id);
  if (!detail) notFound();

  return (
    <PageContainer>
      <SavedJobDetail detail={detail} />
    </PageContainer>
  );
}
