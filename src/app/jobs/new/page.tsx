import type { Metadata } from "next";

import { JobAnalyzer } from "@/components/jobs";
import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Analyse a job",
  description: "Assess a job against your confirmed Waypoint knowledge.",
};

export default function NewJobPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Job analysis"
        title="Is this job worth pursuing?"
        description={
          <>
          Paste the complete description. Waypoint will compare it with your
          confirmed career direction, preferences, evidence, skills and CVs.
          </>
        }
      />
      <JobAnalyzer />
    </PageContainer>
  );
}
