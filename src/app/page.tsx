import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonStyles, PageContainer } from "@/components/ui";
import { createSupabaseAuthServerClient, isSupabaseAuthConfigured } from "@/infrastructure/auth/supabase-auth-server";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseAuthConfigured()) return <PublicLanding />;
  const auth = await createSupabaseAuthServerClient();
  const { data } = await auth.auth.getUser();
  if (!data.user) return <PublicLanding />;

  const { actor, client } = await requireAuthenticatedContext();
  const onboarding = await client
    .from("user_onboarding_state")
    .select("completed_at")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (onboarding.error) throw onboarding.error;
  if (!onboarding.data?.completed_at) redirect("/onboarding");
  const [profile, projects, cvs, analyses] = await Promise.all([
    client.from("master_profile_records").select("id", { count: "exact", head: true }).eq("user_id", actor.userId).eq("status", "confirmed"),
    client.from("master_profile_records").select("id", { count: "exact", head: true }).eq("user_id", actor.userId).eq("status", "confirmed").eq("record_type", "project"),
    client.from("cv_documents_v2").select("id", { count: "exact", head: true }).eq("user_id", actor.userId),
    client.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", actor.userId).eq("status", "completed"),
  ]);
  const metrics = [
    { label: "Master Profile records", value: profile.count ?? 0 }, { label: "Projects", value: projects.count ?? 0 },
    { label: "CV documents", value: cvs.count ?? 0 }, { label: "Job analyses", value: analyses.count ?? 0 },
  ];
  return <PageContainer>
    <section className="grid gap-10 border-b border-slate-200 pb-10 pt-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Evidence before advice</p><h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-5xl">Career decisions grounded in what you have actually done.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Build your evidence base, compare it with a role, and turn the result into a stronger application.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/jobs/new" className={buttonStyles.primary}>Analyse a job</Link><Link href="/profile" className={buttonStyles.secondary}>Add career evidence</Link></div></div><HowItWorks /></section>
    <section className="py-10"><p className="text-sm font-semibold text-slate-950">Your workspace</p><p className="mt-1 text-sm text-slate-600">A snapshot of your confirmed, private information.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p><p className="mt-1 text-sm text-slate-500">{metric.label}</p></div>)}</div></section>
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

function HowItWorks() { return <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-950">Your next steps</p><ol className="mt-5 space-y-4">{["Build and confirm your Master Profile.", "Add your existing role-specific CVs.", "Analyse a role, choose a CV, and prepare the application."].map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{index + 1}</span>{step}</li>)}</ol></aside>; }
