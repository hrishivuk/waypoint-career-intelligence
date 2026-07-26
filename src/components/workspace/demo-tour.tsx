"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "waypoint_demo_tour";

const steps = [
  { path: "/demo/profile", target: "profile-input", title: "Build the Master Profile", description: "A user adds their career story here. Waypoint turns it into structured proposals instead of treating unverified AI output as fact." },
  { path: "/demo/knowledge", target: "skills", title: "Review usable knowledge", description: "Confirmed skills, levels and supporting experience form the evidence base used for career decisions." },
  { path: "/demo/cvs", target: "cv-library", title: "Keep CVs separate", description: "Each CV is an application document with a different emphasis. It does not overwrite the candidate’s wider knowledge." },
  { path: "/demo/jobs", target: "job-fit", title: "Analyse personal fit", description: "Waypoint compares atomic job requirements with confirmed evidence and clearly separates support, unknowns and genuine conflicts." },
  { path: "/demo/jobs", target: "best-cv", title: "Choose the best CV", description: "Only after assessing personal fit does Waypoint rank the stored CVs and explain what should be tailored." },
  { path: "/demo/application-kit", target: "application-kit", title: "Finish the application", description: "Reusable details and polished answers reduce repetitive form filling while remaining editable and under the user’s control." },
] as const;

export function DemoTour() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const requested = searchParams.get("tour") === "start";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (requested) {
      window.localStorage.setItem(STORAGE_KEY, "0");
      queueMicrotask(() => {
        setStepIndex(0);
        setActive(true);
      });
      router.replace(steps[0].path);
      return;
    }
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < steps.length) {
        queueMicrotask(() => {
          setStepIndex(parsed);
          setActive(true);
        });
      }
    }
  }, [router, searchParams]);

  useEffect(() => {
    function restart() {
      window.localStorage.setItem(STORAGE_KEY, "0");
      setStepIndex(0);
      setActive(true);
      router.push(steps[0].path);
    }
    window.addEventListener("waypoint:restart-demo-tour", restart);
    return () => window.removeEventListener("waypoint:restart-demo-tour", restart);
  }, [router]);

  const step = steps[stepIndex];

  useEffect(() => {
    if (!active || pathname !== step.path) return;
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!element) return;
    const classes = ["relative", "z-20", "ring-4", "ring-indigo-400", "ring-offset-4", "transition-shadow"];
    const competingActions = element.querySelectorAll<HTMLElement>("[data-tour-competing-action]");
    element.classList.add(...classes);
    for (const action of competingActions) {
      action.classList.add("invisible");
      action.setAttribute("aria-hidden", "true");
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    primaryActionRef.current?.focus();
    return () => {
      element.classList.remove(...classes);
      for (const action of competingActions) {
        action.classList.remove("invisible");
        action.removeAttribute("aria-hidden");
      }
    };
  }, [active, pathname, step]);

  if (!active || pathname !== step.path) return null;

  function move(nextIndex: number) {
    setStepIndex(nextIndex);
    window.localStorage.setItem(STORAGE_KEY, String(nextIndex));
    router.push(steps[nextIndex].path);
  }

  function close() {
    window.localStorage.removeItem(STORAGE_KEY);
    setActive(false);
  }

  const last = stepIndex === steps.length - 1;

  return (
    <>
      <div className="fixed inset-0 z-10 bg-slate-950/20" aria-hidden="true" />
      <aside aria-live="polite" aria-label="Guided demo" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Step {stepIndex + 1} of {steps.length}</p>
          <button type="button" onClick={close} className="text-sm font-medium text-slate-500 hover:text-slate-900">Skip tour</button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-950">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" disabled={stepIndex === 0} onClick={() => move(stepIndex - 1)} className="min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:invisible">Back</button>
          <button ref={primaryActionRef} type="button" onClick={() => (last ? close() : move(stepIndex + 1))} className="min-h-10 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">{last ? "Finish tour" : "Next"}</button>
        </div>
      </aside>
    </>
  );
}
