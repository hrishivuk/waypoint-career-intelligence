import type { Metadata } from "next";

import { KnowledgeReview } from "@/components/knowledge-review";
import { CareerProfileSectionHeader } from "@/components/profile/career-profile-section-header";

export const metadata: Metadata = {
  title: "Review imported knowledge",
  description:
    "Review proposed career knowledge before it becomes trusted context.",
};

export default function KnowledgeReviewPage() {
  return (
    <>
      <CareerProfileSectionHeader
        title="Review profile changes"
        description={
          <>
          Imported information starts as a proposal. Confirm only what is
          accurate, correct what needs changing, and reject what should not be
          used. Completed decisions remain available here as an audit trail.
          </>
        }
      />
      <KnowledgeReview />
    </>
  );
}
