import { DemoPage } from "@/components/workspace/demo-page";
import { demoWorkspace } from "@/demo/fixtures/workspace";

export default function DemoKnowledgePage() {
  return (
    <DemoPage
      eyebrow="Tour step 2 · Confirmed knowledge"
      title="What Waypoint is allowed to use"
      description="Skills and supporting career evidence remain structured, inspectable and separate from CV documents."
    >
      <section data-tour="skills">
        <h2 className="text-xl font-semibold text-slate-950">Skills and levels</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {demoWorkspace.knowledge.skills.map((skill) => (
            <article key={skill.name} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium text-slate-950">{skill.name}</h3>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium capitalize text-indigo-700">{skill.level}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: levelWidth(skill.level) }} />
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Experience evidence</h2>
          <div className="mt-4 space-y-3">
            {demoWorkspace.knowledge.experience.map((item) => <Card key={item.title} {...item} />)}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Projects</h2>
          <div className="mt-4 space-y-3">
            {demoWorkspace.knowledge.projects.map((item) => <Card key={item.title} {...item} />)}
          </div>
        </div>
      </section>
    </DemoPage>
  );
}

function Card({ title, detail }: { title: string; detail: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-medium text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></article>;
}

function levelWidth(level: string) {
  return { basic: "35%", working: "60%", strong: "85%", expert: "100%" }[level] ?? "20%";
}

