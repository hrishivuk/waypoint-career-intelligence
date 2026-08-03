import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button-variants";

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[var(--content-max)] px-4 py-8 outline-none focus-visible:shadow-none sm:px-6 sm:py-10 lg:px-8 lg:py-12"
    >
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-[var(--border-subtle)] pb-7 sm:mb-10 sm:pb-9">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[var(--reading-max)]">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-primary before:h-px before:w-5 before:bg-primary before:content-['']">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-[var(--line-height-heading)] tracking-[var(--tracking-tight)] text-foreground sm:text-4xl">
            {title}
          </h1>
          <div className="mt-3 max-w-2xl text-base leading-[var(--line-height-body)] text-muted-foreground sm:mt-4">
            {description}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export const buttonStyles = {
  primary: buttonVariants({ variant: "default", size: "default" }),
  secondary: buttonVariants({ variant: "outline", size: "default" }),
} as const;
