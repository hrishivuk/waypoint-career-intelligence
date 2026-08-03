"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AiProviderSettings } from "@/components/settings/ai-provider-settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Step = "welcome" | "provider" | "consent" | "profile" | "cv" | "complete";
type State = {
  currentStep: Step;
  completedSteps: Step[];
  preferredAiProvider: "openai" | "groq" | null;
  aiDataProcessingAcceptedAt: string | null;
  completedAt: string | null;
};

type Phase = {
  id: "welcome" | "provider" | "consent" | "first-data";
  label: string;
  target: Step;
};

const phases: readonly Phase[] = [
  { id: "welcome", label: "Welcome", target: "welcome" },
  { id: "provider", label: "AI setup", target: "provider" },
  { id: "consent", label: "Privacy", target: "consent" },
  { id: "first-data", label: "First data", target: "profile" },
];

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
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load onboarding.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function move(
    currentStep: Step,
    completedStep?: Step,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep, completedStep, ...extra }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setState(body.state);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save your progress.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!state && !error) {
    return (
      <Card aria-live="polite">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading your saved progress…
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Setup could not be loaded</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const activePhase = phaseForStep(state.currentStep);
  const activeIndex = phases.findIndex((phase) => phase.id === activePhase);
  const progress = state.completedAt ? 100 : (activeIndex + 1) * 25;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <aside className="rounded-2xl bg-sidebar p-4 text-sidebar-foreground shadow-sm lg:sticky lg:top-24">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-sidebar-muted">
          <span>Setup progress</span>
          <span>{activeIndex + 1} of {phases.length}</span>
        </div>
        <progress
          value={progress}
          max={100}
          aria-label="Setup progress"
          className="mt-2 h-1 w-full overflow-hidden rounded-full accent-primary"
        />

        <nav aria-label="Onboarding steps" className="mt-5">
          <ol className="space-y-1">
            {phases.map((phase, index) => {
              const active = phase.id === activePhase;
              const done = isPhaseComplete(phase.id, state);
              const target =
                phase.id === "first-data" &&
                ["profile", "cv", "complete"].includes(state.currentStep)
                  ? state.currentStep
                  : phase.target;

              return (
                <li key={phase.id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-current={active ? "step" : undefined}
                    onClick={() => void move(target)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        done
                          ? "border-primary-muted bg-primary text-primary-foreground"
                          : active
                            ? "border-sidebar-foreground bg-sidebar-foreground text-sidebar"
                            : "border-sidebar-border text-sidebar-muted",
                      )}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <span>{phase.label}</span>
                    {done ? <span className="sr-only">, completed</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <p className="mt-5 border-t border-sidebar-border pt-4 text-xs leading-5 text-sidebar-muted">
          Your progress is saved automatically. You can leave and continue later.
        </p>
      </aside>

      <Card className="bg-card shadow-sm">
        <CardContent className="px-6 py-7 sm:px-9 sm:py-10">
          {error ? (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>We could not save that step</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {state.currentStep === "welcome" ? (
            <StepPanel
              step="Step 1 of 4"
              title="Welcome to Waypoint"
              description="Set up a private career workspace for clearer, evidence-based job decisions."
            >
              <div className="rounded-xl bg-muted/70 p-5 text-sm leading-6 text-muted-foreground">
                <p>
                  You will choose how AI is used, review what information may be
                  shared, and decide whether to add career evidence or a CV now.
                </p>
                <p className="mt-3 font-medium text-foreground">
                  Waypoint never submits anything to an employer.
                </p>
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void move("provider", "welcome")}
                className="mt-7"
              >
                Set up AI
              </Button>
            </StepPanel>
          ) : null}

          {state.currentStep === "provider" ? (
            <StepPanel
              step="Step 2 of 4"
              title="Choose how Waypoint uses AI"
              description="Connect OpenAI or Groq with your own API key. Usage is billed by the provider directly to you."
            >
              <AiProviderSettings
                onSaved={(provider) =>
                  void move("consent", "provider", {
                    preferredAiProvider: provider,
                  })
                }
              />
              <div className="mt-7 border-t border-border pt-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  Prefer to decide later? CV storage and other deterministic
                  features remain available, but AI-assisted profile extraction
                  and job analysis will stay unavailable until you connect a key.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void move("consent", "provider")}
                  className="mt-3"
                >
                  Continue without AI
                </Button>
              </div>
            </StepPanel>
          ) : null}

          {state.currentStep === "consent" ? (
            <StepPanel
              step="Step 3 of 4"
              title="You control what is shared"
              description="Waypoint sends information only when you choose an AI-assisted action."
            >
              <div className="rounded-xl bg-muted/70 p-5 text-sm leading-6 text-muted-foreground">
                <p>
                  The relevant job description, CV text, or career evidence may
                  be sent to your selected provider. Its retention, billing, and
                  usage terms also apply.
                </p>
                <p className="mt-3">
                  AI output remains reviewable. Verify generated content before
                  relying on it or using it in an application.
                </p>
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/50 p-4 text-sm leading-6 text-foreground">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span>
                  I understand and agree to this data processing when I use
                  AI-assisted features.
                </span>
              </label>
              <Button
                type="button"
                disabled={busy || !accepted}
                onClick={() =>
                  void move("profile", "consent", {
                    acceptAiDataProcessing: true,
                  })
                }
                className="mt-7"
              >
                Continue to first data
              </Button>
            </StepPanel>
          ) : null}

          {state.currentStep === "profile" ? (
            <StepPanel
              step="Step 4 of 4"
              title="Start with what makes you credible"
              description="Career evidence gives Waypoint a trustworthy source for job decisions. You can add it now or return later."
            >
              <ChoiceCard
                title="Add to your Career Profile"
                description="Describe your experience, skills, projects, or achievements. Suggested changes stay reviewable until you confirm them."
              >
                <Link
                  href="/profile"
                  className={buttonVariants({ variant: "default" })}
                >
                  Add career evidence
                </Link>
              </ChoiceCard>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void move("cv", "profile")}
                >
                  Continue to CV
                </Button>
                <span className="text-xs text-muted-foreground">
                  Adding profile information is optional during setup.
                </span>
              </div>
            </StepPanel>
          ) : null}

          {state.currentStep === "cv" ? (
            <StepPanel
              step="Step 4 of 4"
              title="Add a CV—or finish for now"
              description="CVs remain separate from your Career Profile so Waypoint can judge what each document visibly communicates."
            >
              <ChoiceCard
                title="Upload a role-specific CV"
                description="Add a PDF or DOCX now, or wait until you have a role you want to compare it with."
              >
                <Link
                  href="/cvs"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Go to CV library
                </Link>
              </ChoiceCard>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void move("complete", "cv", { completed: true })
                }
                className="mt-7"
              >
                {busy ? "Finishing setup…" : "Finish setup"}
              </Button>
            </StepPanel>
          ) : null}

          {state.currentStep === "complete" ? (
            <StepPanel
              step="Setup complete"
              title="Your workspace is ready"
              description="Waypoint will keep guiding you toward the next useful step. You can change your provider or add more evidence at any time."
            >
              {!state.completedAt ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void move("complete", "complete", { completed: true })
                  }
                >
                  {busy ? "Finishing setup…" : "Finish setup"}
                </Button>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/jobs/new"
                    className={buttonVariants({ variant: "default" })}
                  >
                    Analyse your first job
                  </Link>
                  <Link
                    href="/"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Go to Home
                  </Link>
                </div>
              )}
            </StepPanel>
          ) : null}

          <div className="mt-9 flex items-center justify-between border-t border-border pt-5">
            <Button
              type="button"
              variant="ghost"
              disabled={busy || state.currentStep === "welcome"}
              onClick={() => void move(previousStep(state.currentStep))}
            >
              Back
            </Button>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {state.completedAt
                ? "Setup complete"
                : `Step ${activeIndex + 1} of ${phases.length}`}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepPanel({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby="onboarding-step-title">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        {step}
      </p>
      <h2
        id="onboarding-step-title"
        className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
      >
        {title}
      </h2>
      <p className="mb-7 mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        {description}
      </p>
      {children}
    </section>
  );
}

function ChoiceCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-background/60 shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="max-w-2xl leading-6">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function phaseForStep(step: Step): Phase["id"] {
  if (step === "welcome" || step === "provider" || step === "consent") {
    return step;
  }
  return "first-data";
}

function isPhaseComplete(phase: Phase["id"], state: State) {
  if (state.completedAt) return true;
  if (phase === "first-data") return false;
  return state.completedSteps.includes(phase);
}

function previousStep(step: Step): Step {
  if (step === "provider") return "welcome";
  if (step === "consent") return "provider";
  if (step === "profile") return "consent";
  if (step === "cv" || step === "complete") return "profile";
  return "welcome";
}
