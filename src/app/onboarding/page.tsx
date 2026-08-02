import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Get started", description: "Set up your private Waypoint workspace." };

export default function OnboardingPage() {
  return <PageContainer><PageHeader eyebrow="Getting started" title="Set up your workspace" description="Connect the services you want to use and add as much career context as you are comfortable sharing." /><OnboardingFlow /></PageContainer>;
}
