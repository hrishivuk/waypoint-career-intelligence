import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Legal"
        title="Beta terms"
        description="Important responsibilities and limits for using Waypoint’s career-assistance tools."
      />
      <article className="max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="space-y-7 p-5 text-sm leading-7 text-muted-foreground sm:p-8">
          <LegalSection title="Decision support, not a guarantee">
            Waypoint is a career-organisation and decision-support tool. It
            does not guarantee employment, interviews, eligibility,
            compensation, or the accuracy of information supplied by an
            employer or another third party.
          </LegalSection>
          <LegalSection title="Review every output">
            AI-generated and extracted content may be incomplete or incorrect.
            You remain responsible for checking every application, factual
            claim, eligibility decision, and document before relying on or
            submitting it.
          </LegalSection>
          <LegalSection title="Your provider account">
            You are responsible for your connected AI-provider account,
            credentials, charges, quotas, and compliance with that provider’s
            terms. Never share a key you do not own or have permission to use.
          </LegalSection>
          <LegalSection title="Acceptable use">
            Do not upload material you do not have permission to process, try
            to access another person’s account, disrupt the service, bypass
            usage or security controls, or use Waypoint to create deceptive
            application claims.
          </LegalSection>
          <LegalSection title="Public beta">
            The service may change, experience interruptions, or remove beta
            features while reliability and usability are evaluated. Accounts
            that threaten the service or other users may be restricted. Final
            operator, support, governing-law, and liability terms will be
            published before general availability.
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
