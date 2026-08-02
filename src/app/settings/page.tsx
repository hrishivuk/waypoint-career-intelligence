import type { Metadata } from "next";

import { AiProviderSettings } from "@/components/settings/ai-provider-settings";
import { AccountDataControls } from "@/components/settings/account-data-controls";
import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings", description: "Manage your Waypoint AI provider and account preferences." };

export default function SettingsPage() {
  return <PageContainer><PageHeader eyebrow="Settings" title="AI provider" description="Connect the provider Waypoint should use for AI-assisted extraction and matching. You can replace or remove a saved key at any time." />
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><AiProviderSettings /></section><aside className="space-y-4"><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">What is shared</h2><p className="mt-2 text-sm leading-6 text-slate-600">When you use an AI-assisted feature, the relevant job description, career evidence, or CV text is sent to your selected provider. Waypoint does not transfer ChatGPT history or memories.</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Stay in control</h2><p className="mt-2 text-sm leading-6 text-slate-600">Your key is encrypted at rest, used only on the server for your requests, and never returned after saving. Removing it disables provider-backed features until you add another.</p></div></aside></div>
    <div className="mt-10"><PageHeader eyebrow="Account" title="Your data" description="Export your information or permanently remove your Waypoint account." /><AccountDataControls /></div>
  </PageContainer>;
}
