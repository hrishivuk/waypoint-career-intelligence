import type { ReactNode } from "react";

export function CareerProfileSectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-[var(--reading-max)]">
        <h2 className="text-2xl font-semibold tracking-[var(--tracking-tight)] text-foreground">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
