import type { Metadata } from "next";
import { Database, KeyRound, ShieldCheck } from "lucide-react";

import { AiProviderSettings } from "@/components/settings/ai-provider-settings";
import { AccountDataControls } from "@/components/settings/account-data-controls";
import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings", description: "Manage your Waypoint AI provider and account preferences." };

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Manage the AI provider connected to Waypoint and control the data associated with your account."
      />

      <section aria-labelledby="ai-provider-heading">
        <div className="mb-6 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-primary">
            AI & privacy
          </p>
          <h2
            id="ai-provider-heading"
            className="mt-2 flex items-center gap-2 font-heading text-2xl font-semibold tracking-[var(--tracking-tight)] text-foreground"
          >
            <KeyRound aria-hidden="true" className="size-5 text-primary" />
            Connected provider
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose the provider Waypoint uses for AI-assisted extraction and
            matching. You can replace or remove a saved key at any time.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <AiProviderSettings />
          </div>
          <aside
            aria-label="AI data processing information"
            className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] lg:self-start"
          >
            <div className="p-5">
              <h3 className="flex items-center gap-2 font-heading font-semibold text-foreground">
                <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
                What is shared
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                When you use an AI-assisted feature, the relevant job
                description, career evidence, or CV text is sent to your
                selected provider. Waypoint does not transfer ChatGPT history
                or memories.
              </p>
            </div>
            <div className="border-t border-[var(--border-subtle)] p-5">
              <h3 className="flex items-center gap-2 font-heading font-semibold text-foreground">
                <KeyRound aria-hidden="true" className="size-4 text-primary" />
                Stay in control
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your key is encrypted at rest, used only on the server for your
                requests, and never returned after saving. Removing it disables
                provider-backed features until you add another.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section
        aria-labelledby="account-data-heading"
        className="mt-14 border-t border-[var(--border-subtle)] pt-10"
      >
        <div className="mb-6 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-primary">
            Account & data
          </p>
          <h2
            id="account-data-heading"
            className="mt-2 flex items-center gap-2 font-heading text-2xl font-semibold tracking-[var(--tracking-tight)] text-foreground"
          >
            <Database aria-hidden="true" className="size-5 text-primary" />
            Your Waypoint data
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Download a copy of your information or permanently remove your
            account and its stored data.
          </p>
        </div>
        <AccountDataControls />
      </section>
    </PageContainer>
  );
}
