import Link from "next/link";

import { demoCandidate } from "@/demo/fixtures/candidate";

export function DemoOverview() {
  const metrics = [
    ["Profile records", demoCandidate.metrics.profileRecords],
    ["Projects", demoCandidate.metrics.projects],
    ["CV documents", demoCandidate.metrics.cvDocuments],
    ["Job analyses", demoCandidate.metrics.jobAnalyses],
  ] as const;

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <section className="grid gap-8 border-b border-slate-200 pb-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Fictional demo candidate
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            {demoCandidate.name}
          </h1>
          <p className="mt-2 text-lg font-medium text-indigo-700">{demoCandidate.headline}</p>
          <p className="mt-4 max-w-2xl leading-7 text-slate-600">{demoCandidate.summary}</p>
          <Link href="/demo/profile" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white">
            Start guided walkthrough
          </Link>
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-950">Demo safety</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li>✓ Fictional career and CV data</li>
            <li>✓ No Groq or OpenAI requests</li>
            <li>✓ No access to the personal database workspace</li>
            <li>✓ Demo changes will stay in this browser</li>
          </ul>
        </aside>
      </section>
      <section className="py-10">
        <h2 className="font-semibold text-slate-950">Prepared workspace</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-3xl font-semibold text-slate-950">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
