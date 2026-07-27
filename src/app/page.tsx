import Link from "next/link";

import { buttonStyles, PageContainer } from "@/components/ui";
import { DemoOverview } from "@/components/workspace/demo-overview";
import { WorkspaceGateway } from "@/components/workspace/workspace-gateway";
import { FixedPrototypeIdentityProvider } from "@/infrastructure/auth/fixed-prototype-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";
import { getWorkspaceMode } from "@/infrastructure/workspace/server-workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const mode = await getWorkspaceMode();
  if (!mode) {
    return (
      <WorkspaceGateway
        demoOnly={
          process.env.PORTFOLIO_DEMO_ONLY === "true" ||
          !process.env.SUPABASE_URL
        }
      />
    );
  }
  if (mode === "demo") return <DemoOverview />;
  const actor = await new FixedPrototypeIdentityProvider().getActor();
  const client = getSupabaseServerClient();
  const [profile, projects, cvs, analyses] = await Promise.all([
    client
      .from("master_profile_records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", actor.userId)
      .eq("status", "confirmed"),
    client
      .from("master_profile_records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", actor.userId)
      .eq("status", "confirmed")
      .eq("record_type", "project"),
    client
      .from("cv_documents_v2")
      .select("id", { count: "exact", head: true })
      .eq("user_id", actor.userId),
    client
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", actor.userId)
      .eq("status", "completed"),
  ]);
  const metrics = [
    { label: "Master Profile records", value: profile.count ?? 0 },
    { label: "Projects", value: projects.count ?? 0 },
    { label: "CV documents", value: cvs.count ?? 0 },
    { label: "Job analyses", value: analyses.count ?? 0 },
  ];

  return (
    <PageContainer>
      <section className="grid gap-10 border-b border-slate-200 pb-10 pt-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Evidence before advice
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-5xl">
            Career decisions grounded in what you have actually done.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Waypoint combines confirmed career knowledge, CV evidence and
            AI-assisted analysis in one reviewable personal workspace.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/jobs/new" className={buttonStyles.primary}>
              Analyse a job
            </Link>
            <Link href="/knowledge" className={buttonStyles.secondary}>
              Review my knowledge
            </Link>
          </div>
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-950">
            How Waypoint works
          </p>
          <ol className="mt-5 space-y-4">
            {[
              "Build and confirm your independent Master Profile.",
              "Store role-specific CVs as separate application documents.",
              "Assess personal fit, then choose and tailor the strongest CV.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-6 text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="py-10">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            Workspace overview
          </p>
          <p className="mt-1 text-sm text-slate-600">
            A snapshot of the confirmed information currently available.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-3xl font-semibold tracking-tight text-slate-950">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-slate-500">{metric.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-8">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h2 className="font-semibold text-slate-950">Data management</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Review imported records, skill assessments or manually entered
            profile facts when you need to maintain the underlying data.
          </p>
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap gap-3 text-sm sm:mt-0">
          <Link href="/knowledge/review" className="font-medium text-slate-700 hover:text-indigo-700">
            Imported records
          </Link>
          <Link href="/knowledge/skills/review" className="font-medium text-slate-700 hover:text-indigo-700">
            Skill review
          </Link>
          <Link href="/profile" className="font-medium text-slate-700 hover:text-indigo-700">
            Manual facts
          </Link>
        </div>
        </div>
      </section>
    </PageContainer>
  );
}
