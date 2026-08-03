import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, FileText, Sparkles, UserRound } from "lucide-react";

import { decideHomeReadiness } from "@/application/home/readiness";
import { buttonStyles, PageContainer } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button-variants";
import { createSupabaseAuthServerClient, isSupabaseAuthConfigured } from "@/infrastructure/auth/supabase-auth-server";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseAuthConfigured()) return <PublicLanding />;
  const auth = await createSupabaseAuthServerClient();
  const { data } = await auth.auth.getUser();
  if (!data.user) return <PublicLanding />;

  const { actor, client } = await requireAuthenticatedContext();
  const onboarding = await client
    .from("user_onboarding_state")
    .select("completed_at, preferred_ai_provider")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (onboarding.error) throw onboarding.error;
  if (!onboarding.data?.completed_at) redirect("/onboarding");
  const [profile, cvs, analyses] = await Promise.all([
    client.from("master_profile_records").select("id", { count: "exact", head: true }).eq("user_id", actor.userId).eq("status", "confirmed"),
    client.from("cv_documents_v2").select("id", { count: "exact", head: true }).eq("user_id", actor.userId),
    client.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", actor.userId).eq("status", "completed"),
  ]);
  const connectedProvider = onboarding.data.preferred_ai_provider === "openai" || onboarding.data.preferred_ai_provider === "groq"
    ? onboarding.data.preferred_ai_provider
    : null;
  const snapshot = {
    connectedProvider,
    confirmedProfileCount: profile.count ?? 0,
    cvDocumentCount: cvs.count ?? 0,
  };
  const nextAction = decideHomeReadiness(snapshot);
  const readiness = [
    { label: "Career Profile", value: snapshot.confirmedProfileCount, ready: snapshot.confirmedProfileCount > 0, href: "/knowledge", icon: UserRound, unit: "confirmed records" },
    { label: "CV library", value: snapshot.cvDocumentCount, ready: snapshot.cvDocumentCount > 0, href: "/cvs", icon: FileText, unit: "documents" },
    { label: "AI provider", value: connectedProvider ? 1 : 0, ready: Boolean(connectedProvider), href: "/settings", icon: Sparkles, unit: connectedProvider ?? "not connected" },
  ];

  return <PageContainer>
    <header className="flex flex-col gap-6 border-b border-[var(--border-subtle)] pb-8 sm:pb-10 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-[var(--reading-max)]">
        <p className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-primary">Your workspace</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[var(--tracking-tight)] text-foreground sm:text-4xl">Make the next career decision from evidence.</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">Waypoint keeps your reviewed career history, CVs and job decisions connected in one private workspace.</p>
      </div>
      <Link href="/jobs/new" className={buttonVariants({ size: "lg" })}>Analyse a job<ArrowRight aria-hidden="true" /></Link>
    </header>

    <section aria-labelledby="next-step-title" className="mt-8 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-5 shadow-sm sm:p-7">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-primary">Next best step</p>
          <h2 id="next-step-title" className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{nextAction.label}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{nextAction.description}</p>
        </div>
        <Link href={nextAction.href} className={cn(buttonVariants({ size: "default" }), "md:min-w-48")}>{nextAction.label}<ArrowRight aria-hidden="true" /></Link>
      </div>
    </section>

    <section aria-labelledby="readiness-title" className="py-9">
      <div className="flex items-end justify-between gap-4">
        <div><h2 id="readiness-title" className="text-lg font-semibold text-foreground">Workspace readiness</h2><p className="mt-1 text-sm text-muted-foreground">The information available for your next analysis.</p></div>
        <span className="hidden text-sm text-muted-foreground sm:inline">Private to your account</span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {readiness.map((item) => <Link key={item.label} href={item.href} className="group rounded-xl border border-[var(--border-subtle)] bg-card p-5 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]">
          <div className="flex items-center justify-between gap-4"><span className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-foreground"><item.icon className="size-5" aria-hidden="true" /></span>{item.ready ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]"><CheckCircle2 className="size-4" aria-hidden="true" />Ready</span> : <span className="text-xs font-semibold text-[var(--warning)]">Needs attention</span>}</div>
          <h3 className="mt-5 font-semibold text-foreground group-hover:text-primary">{item.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.value > 0 ? `${item.value} ${item.unit}` : item.unit}</p>
        </Link>)}
      </div>
    </section>

    <section aria-labelledby="activity-title" className="border-t border-[var(--border-subtle)] pt-8">
      <div className="rounded-xl bg-[var(--surface-sunken)] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div className="flex items-start gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-primary"><BriefcaseBusiness className="size-5" aria-hidden="true" /></span><div><h2 id="activity-title" className="font-semibold text-foreground">Job analysis activity</h2><p className="mt-1 text-sm text-muted-foreground">{analyses.count ? `${analyses.count} completed ${analyses.count === 1 ? "analysis" : "analyses"} in your workspace.` : "No jobs analysed yet. Your first result will appear here."}</p></div></div>
        <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:text-[var(--primary-hover)] sm:mt-0">{analyses.count ? "View jobs" : "Analyse your first job"}<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>
    </section>
  </PageContainer>;
}

function PublicLanding() {
  const features = [
    ["A living Master Profile", "Turn career history into structured, reviewable evidence instead of a one-off chat."],
    ["Evidence-aware job analysis", "Break roles into requirements and see where your experience supports, conflicts with, or leaves uncertainty."],
    ["Smarter CV selection", "Keep role-specific CVs separate and identify the strongest starting point for each application."],
    ["Reusable application knowledge", "Keep useful answers and details ready without losing control of what gets submitted."],
  ];
  return <main id="main-content" className="bg-white">
    <header className="border-b border-slate-200"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8"><Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">Waypoint</Link><nav className="flex items-center gap-2" aria-label="Account"><Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign in</Link><Link href="/signup" className={buttonStyles.primary}>Create account</Link></nav></div></header>
    <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50"><div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-indigo-100/70 to-transparent" /><div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Career intelligence you can inspect</p><h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-[-0.045em] text-slate-950 sm:text-6xl">Make your next career move from evidence, not guesswork.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Waypoint brings your career knowledge, CVs, job-fit analysis, and reusable application material into one private workspace.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/signup" className={buttonStyles.primary}>Start building your profile</Link><Link href="/login" className={buttonStyles.secondary}>Sign in</Link></div><p className="mt-4 text-xs text-slate-500">Bring your own supported AI provider key. You control provider usage and billing.</p></div></section>
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold text-indigo-700">One connected workflow</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">From career history to application decision</h2></div><div className="mt-9 grid gap-4 md:grid-cols-2">{features.map(([title, description], index) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">{index + 1}</span><h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div></section>
    <section className="border-y border-slate-200 bg-slate-950 text-white"><div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">{[["Private by design", "Every account has an isolated career workspace."], ["Human-reviewed", "AI suggestions remain proposals until you confirm them."], ["Provider choice", "Use your own API credential and remove it when you choose."]].map(([title, description]) => <div key={title}><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{description}</p></div>)}</div></section>
    <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6"><h2 className="text-3xl font-semibold tracking-tight text-slate-950">Build a clearer picture of where you fit.</h2><p className="mt-4 text-slate-600">Create your account, add your evidence, and make each application more deliberate.</p><Link href="/signup" className={`${buttonStyles.primary} mt-7`}>Create your Waypoint account</Link></section>
    <footer className="border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500">Waypoint · Always verify application content before submitting. · <Link href="/privacy" className="hover:text-indigo-700">Privacy</Link> · <Link href="/terms" className="hover:text-indigo-700">Terms</Link></footer>
  </main>;
}
