import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Legal"
        title="Privacy overview"
        description="How Waypoint handles career information and provider credentials during the public beta."
      />
      <article className="max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="space-y-7 p-5 text-sm leading-7 text-muted-foreground sm:p-8">
          <LegalSection title="Information stored">
            Your account stores the career knowledge you enter or confirm,
            uploaded CVs, job descriptions, analyses, onboarding choices, and
            reusable application information needed to provide Waypoint’s
            workflows.
          </LegalSection>
          <LegalSection title="AI providers">
            When you start an AI-assisted action, the relevant content is sent
            to the OpenAI or Groq account you connected. The selected
            provider’s terms, billing, retention, and privacy practices also
            apply. Waypoint does not send career content to an AI provider
            merely because you view a page.
          </LegalSection>
          <LegalSection title="Provider credentials">
            Saved API keys are encrypted on the server, never displayed after
            saving, and excluded from account exports. You can replace or
            remove a key at any time. Deleting your account also removes its
            saved provider credentials.
          </LegalSection>
          <LegalSection title="Your controls">
            You can correct stored knowledge, remove CVs, export a ZIP of your
            structured account information and original CV files, remove
            provider keys, and permanently delete your account from Settings.
          </LegalSection>
          <LegalSection title="Beta notice">
            Waypoint is currently an independently operated portfolio beta,
            not an employment agency. Additional operator, support, hosting
            region, subprocessor, retention, and jurisdiction-specific
            disclosures will be published before a general-availability
            release. Do not add information you are not comfortable processing
            under these beta conditions.
          </LegalSection>
        </div>
        <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 py-4 text-xs text-muted-foreground sm:px-8">
          Last updated: 3 August 2026
        </footer>
      </article>
    </PageContainer>
  );
}

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5">{children}</p>
    </section>
  );
}
