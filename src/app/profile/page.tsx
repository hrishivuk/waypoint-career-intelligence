import type { Metadata } from "next";

import { NarrativeImporter } from "@/components/profile";
import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Career profile",
  description: "Build and review the knowledge your career coach can use.",
};

export default function ProfilePage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Data management"
        title="Build your Master Profile"
        description={
          <>
          Turn your complete career narrative into grouped, source-supported
          knowledge. Nothing becomes active until you approve the review.
          </>
        }
      />
      <NarrativeImporter />
    </PageContainer>
  );
}
