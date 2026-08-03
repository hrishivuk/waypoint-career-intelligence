import type { Metadata } from "next";

import { CareerProfileSectionHeader } from "@/components/profile/career-profile-section-header";
import { NarrativeImporter } from "@/components/profile";

export const metadata: Metadata = {
  title: "Career profile",
  description: "Build and review the knowledge your career coach can use.",
};

export default function ProfilePage() {
  return (
    <>
      <CareerProfileSectionHeader
        title="Add information"
        description={
          <>
          Describe your experience in your own words. Waypoint will structure
          proposed changes for you to inspect before anything is confirmed.
          </>
        }
      />
      <NarrativeImporter />
    </>
  );
}
