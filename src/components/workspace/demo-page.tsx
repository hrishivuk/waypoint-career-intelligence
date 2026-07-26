import type { ReactNode } from "react";

export function DemoPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-8 sm:mb-10 sm:pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
      </header>
      {children}
    </main>
  );
}

