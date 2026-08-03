import type { Metadata } from "next";

import { CareerProfileNav } from "@/components/profile/career-profile-nav";
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
        eyebrow="Career Profile"
        title="Add information"
        description={
          <>
          Describe your experience in your own words. Waypoint will structure
          proposed changes for you to inspect before anything is confirmed.
          </>
        }
      />
      <CareerProfileNav />
      <NarrativeImporter />
    </PageContainer>
  );
}
