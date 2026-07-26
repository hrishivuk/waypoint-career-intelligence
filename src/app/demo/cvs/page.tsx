import { DemoPage } from "@/components/workspace/demo-page";
import { demoWorkspace } from "@/demo/fixtures/workspace";

export default function DemoCvsPage() {
  return (
    <DemoPage
      eyebrow="Tour step 3 · CV library"
      title="Different CVs for different opportunities"
      description="Waypoint reads what each document visibly communicates without treating the CV as personal knowledge."
    >
      <div data-tour="cv-library" className="space-y-4">
        {demoWorkspace.cvs.map((cv) => (
          <article key={cv.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950">{cv.name}</h2>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">ATS parsed</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{cv.summary}</p>
                <p className="mt-3 text-sm text-slate-700"><span className="font-medium">Intended for:</span> {cv.intendedRoles.join(", ")}</p>
              </div>
              <span className="rounded-xl bg-indigo-50 px-4 py-3 text-center"><strong className="block text-xl text-indigo-700">{cv.coverage}</strong><span className="text-xs text-indigo-600">sample coverage</span></span>
            </div>
            <div className="mt-5 flex gap-2 text-xs text-slate-500"><span>{cv.sections} sections</span><span>·</span><span>{cv.visibleSkills} visible skills</span></div>
          </article>
        ))}
      </div>
    </DemoPage>
  );
}

