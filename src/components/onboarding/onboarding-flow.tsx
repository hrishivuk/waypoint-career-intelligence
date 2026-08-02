"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AiProviderSettings } from "@/components/settings/ai-provider-settings";
import { buttonStyles } from "@/components/ui";

type Step = "welcome" | "provider" | "consent" | "profile" | "cv" | "complete";
type State = { currentStep: Step; completedSteps: Step[]; preferredAiProvider: "openai" | "groq" | null; aiDataProcessingAcceptedAt: string | null; completedAt: string | null };
const steps: { id: Step; label: string }[] = [{ id: "welcome", label: "Welcome" }, { id: "provider", label: "AI provider" }, { id: "consent", label: "Privacy" }, { id: "profile", label: "Profile" }, { id: "cv", label: "CV" }, { id: "complete", label: "Ready" }];

export function OnboardingFlow() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/onboarding", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setState(body.state);
        setAccepted(Boolean(body.state.aiDataProcessingAcceptedAt));
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load onboarding."); });
    return () => { active = false; };
  }, []);

  async function move(currentStep: Step, completedStep?: Step, extra: Record<string, unknown> = {}) {
    setBusy(true); setError(null);
    try { const response = await fetch("/api/v1/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentStep, completedStep, ...extra }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body.state); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your progress."); }
    finally { setBusy(false); }
  }

  if (!state && !error) return <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading your progress…</p>;
  if (!state) return <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">{error}</p>;
  const activeIndex = steps.findIndex((step) => step.id === state.currentStep);

  return <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
    <nav aria-label="Onboarding progress"><ol className="space-y-2">{steps.map((step, index) => { const done = state.completedSteps.includes(step.id) || Boolean(state.completedAt); const active = step.id === state.currentStep; return <li key={step.id}><button type="button" onClick={() => void move(step.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-white"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>{done ? "✓" : index + 1}</span>{step.label}</button></li>; })}</ol><p className="mt-4 text-xs leading-5 text-slate-500">Your progress is saved. You can leave and continue later.</p></nav>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {error ? <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {state.currentStep === "welcome" ? <StepPanel title="Welcome to Waypoint" description="Set up a private career workspace that turns your evidence into more deliberate job and application decisions."><p className="text-sm leading-6 text-slate-600">You will connect your own AI provider, review how data is shared, then optionally add career evidence and a CV. Nothing is submitted to an employer.</p><Next busy={busy} onClick={() => void move("provider", "welcome")}>Choose an AI provider</Next></StepPanel> : null}
      {state.currentStep === "provider" ? <StepPanel title="Connect an AI provider" description="Waypoint supports OpenAI and Groq. You pay the provider directly for usage."><AiProviderSettings onSaved={(provider) => void move("consent", "provider", { preferredAiProvider: provider })} /><button type="button" disabled={busy} onClick={() => void move("consent", "provider")} className={`${buttonStyles.secondary} mt-5`}>Skip for now</button></StepPanel> : null}
      {state.currentStep === "consent" ? <StepPanel title="Review AI data processing" description="You choose when Waypoint sends information to your connected provider."><div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600"><p>AI-assisted actions may send the relevant job description, CV text, or career evidence to your selected provider. Provider retention, billing, and usage rules also apply.</p><p className="mt-3">Waypoint keeps AI output reviewable. Check generated content before relying on it or sending an application.</p></div><label className="mt-5 flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" /><span>I understand and agree to this data processing when I use AI-assisted features.</span></label><Next busy={busy || !accepted} onClick={() => void move("profile", "consent", { acceptAiDataProcessing: true })}>Continue</Next></StepPanel> : null}
      {state.currentStep === "profile" ? <StepPanel title="Build your Master Profile" description="Add career history and achievements so analysis can be grounded in real evidence."><p className="text-sm leading-6 text-slate-600">You can type evidence manually or import a career narrative. Imported suggestions stay pending until you review them.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/profile" className={buttonStyles.primary}>Add career evidence</Link><button type="button" disabled={busy} onClick={() => void move("cv", "profile")} className={buttonStyles.secondary}>Continue or skip</button></div></StepPanel> : null}
      {state.currentStep === "cv" ? <StepPanel title="Add a role-specific CV" description="Keep your CV documents separate from your broader career evidence."><p className="text-sm leading-6 text-slate-600">Upload an existing CV now, or return when you are ready to compare one against a job.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/cvs" className={buttonStyles.primary}>Go to CV workspace</Link><button type="button" disabled={busy} onClick={() => void move("complete", "cv")} className={buttonStyles.secondary}>Continue or skip</button></div></StepPanel> : null}
      {state.currentStep === "complete" ? <StepPanel title="Your workspace is ready" description="You can revisit any setup step from this page or change your provider in Settings."><div className="grid gap-3 sm:grid-cols-2"><Link href="/jobs/new" className={buttonStyles.primary}>Analyse your first job</Link><Link href="/" className={buttonStyles.secondary}>Go to overview</Link></div>{!state.completedAt ? <button type="button" disabled={busy} onClick={() => void move("complete", "complete", { completed: true })} className="mt-5 text-sm font-semibold text-indigo-700 disabled:opacity-50">Mark onboarding complete</button> : <p role="status" className="mt-5 text-sm font-medium text-emerald-700">Onboarding complete.</p>}</StepPanel> : null}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5"><button type="button" disabled={busy || activeIndex === 0} onClick={() => void move(steps[Math.max(0, activeIndex - 1)].id)} className="text-sm font-medium text-slate-600 disabled:opacity-40">Back</button><span className="text-xs text-slate-400">Step {activeIndex + 1} of {steps.length}</span></div>
    </section>
  </div>;
}

function StepPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Set up Waypoint</p><h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2><p className="mb-6 mt-2 text-sm leading-6 text-slate-600">{description}</p>{children}</div>; }
function Next({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" disabled={busy} onClick={onClick} className={`${buttonStyles.primary} mt-6`}>{children}</button>; }
