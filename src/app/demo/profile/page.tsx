import Link from "next/link";

import { DemoPage } from "@/components/workspace/demo-page";
import { demoWorkspace } from "@/demo/fixtures/workspace";

export default function DemoProfilePage() {
  return (
    <DemoPage
      eyebrow="Tour step 1 · Master Profile"
      title="Turn a career narrative into reviewable knowledge"
      description="This prepared interaction demonstrates the information Waypoint would structure. It does not call an AI provider."
    >
      <section data-tour="profile-input" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-slate-950">Example career narrative</h2>
        <textarea
          className="mt-4 w-full rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
          rows={7}
          defaultValue={demoWorkspace.candidate.sampleNarrative}
        />
        <div className="mt-4 flex justify-end">
          <Link href="/demo/knowledge" className="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white">
            Continue to prepared review
          </Link>
        </div>
      </section>
      <section className="mt-8 grid gap-3 md:grid-cols-3">
        {[
          ["New knowledge", "React, TypeScript and accessibility experience"],
          ["Professional competency", "Cross-functional product collaboration"],
          ["Career pattern", "Growing from frontend delivery into UX thinking"],
        ].map(([title, detail]) => (
          <article key={title} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="font-medium text-emerald-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-emerald-900">{detail}</p>
          </article>
        ))}
      </section>
    </DemoPage>
  );
}
