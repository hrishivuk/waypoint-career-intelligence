import { DemoPage } from "@/components/workspace/demo-page";
import { demoWorkspace } from "@/demo/fixtures/workspace";

export default function DemoJobsPage() {
  const job = demoWorkspace.job;
  return (
    <DemoPage
      eyebrow="Tour step 4 · Prepared analysis"
      title="Personal fit first, CV presentation second"
      description="This deterministic fixture demonstrates the same evidence-aware output shape as the private analysis pipeline."
    >
      <section data-tour="job-fit" className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm text-slate-500">{job.company}</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{job.title}</h2></div>
          <div className="text-right"><span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">{job.recommendation}</span><p className="mt-2 text-3xl font-semibold">{job.overallScore}<span className="text-base font-normal text-slate-400">/100</span></p></div>
        </div>
        <p className="mt-5 max-w-3xl leading-7 text-slate-700">{job.summary}</p>
      </section>
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <ResultList title="Supported by evidence" items={job.strengths} tone="green" />
        <ResultList title="Still unknown" items={job.unknowns} tone="amber" />
      </section>
      <section data-tour="best-cv" className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Step 2 · Best starting CV</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-slate-950">{job.bestCv.name}</h2><p className="mt-1 text-sm text-slate-700">{job.bestCv.represented} of {job.bestCv.relevant} supported requirements are visible.</p></div>
          <strong className="text-2xl text-indigo-700">{job.bestCv.score}/100</strong>
        </div>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">{job.bestCv.changes.map((change) => <li key={change}>{change}</li>)}</ul>
      </section>
    </DemoPage>
  );
}

function ResultList({ title, items, tone }: { title: string; items: readonly string[]; tone: "green" | "amber" }) {
  const styles = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950";
  return <div className={`rounded-2xl border p-5 ${styles}`}><h2 className="font-semibold">{title}</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

