import { DemoPage } from "@/components/workspace/demo-page";
import { DemoCopyButton } from "@/components/workspace/demo-copy-button";
import { demoWorkspace } from "@/demo/fixtures/workspace";

export default function DemoApplicationKitPage() {
  return (
    <DemoPage
      eyebrow="Tour step 5 · Application Kit"
      title="Copy-ready details and reusable answers"
      description="The demo uses fictional answers. The private workspace keeps your own editable application information."
    >
      <div data-tour="application-kit" className="grid gap-3 lg:grid-cols-2">
        {demoWorkspace.applicationAnswers.map((answer) => (
          <article key={answer.label} className="flex min-h-40 flex-col rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-medium text-slate-950">{answer.label}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-700">{answer.value}</p>
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <DemoCopyButton value={answer.value} />
            </div>
          </article>
        ))}
      </div>
    </DemoPage>
  );
}
