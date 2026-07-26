import type { Metadata } from "next";

import { ApplicationKit } from "@/components/application-kit/application-kit";
import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Application Kit",
  description: "Copy-ready personal details and reusable job application answers.",
};

export default function ApplicationKitPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Application helper"
        title="Your copy-ready Application Kit"
        description="Keep frequently requested details and natural reusable answers in one private place. Edit anything at any time, then copy it directly into an application form."
      />
      <ApplicationKit />
    </PageContainer>
  );
}

