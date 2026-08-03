import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { PageContainer } from "@/components/ui";

export const metadata: Metadata = { title: "Get started", description: "Set up your private Waypoint workspace." };

export default function OnboardingPage() {
  return (
    <PageContainer>
      <header className="mb-8 max-w-3xl sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Getting started
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Set up your private workspace
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Four focused steps. Add only what you are comfortable sharing, and
          come back whenever you need to.
        </p>
      </header>
      <OnboardingFlow />
    </PageContainer>
  );
}
