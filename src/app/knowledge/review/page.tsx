import type { Metadata } from "next";

import { KnowledgeReview } from "@/components/knowledge-review";
import { CareerProfileNav } from "@/components/profile/career-profile-nav";
import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Review imported knowledge",
  description:
    "Review proposed career knowledge before it becomes trusted context.",
};

export default function KnowledgeReviewPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Career Profile"
        title="Review profile changes"
        description={
          <>
          Imported information starts as a proposal. Confirm only what is
          accurate, correct what needs changing, and reject what should not be
          used. Completed decisions remain available here as an audit trail.
          </>
        }
      />
      <CareerProfileNav />
      <KnowledgeReview />
    </PageContainer>
  );
}
