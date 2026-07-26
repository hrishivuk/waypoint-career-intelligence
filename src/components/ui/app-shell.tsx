"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { WorkspaceMode } from "@/domain/workspace";

const navigation = [
  { href: "/", label: "Overview", exact: true },
  { href: "/profile", label: "Add knowledge" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/cvs", label: "CVs" },
  { href: "/application-kit", label: "Application Kit" },
  { href: "/jobs/new", label: "Job analysis" },
] as const;

export function AppShell({
  children,
  workspaceMode,
}: {
  children: ReactNode;
  workspaceMode: WorkspaceMode | null;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      {workspaceMode === "demo" ? (
        <div className="bg-indigo-700 px-4 py-2 text-center text-xs font-medium text-white">
          Guided demo · Fictional data · No external AI calls
        </div>
      ) : null}
      {workspaceMode ? (
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0">
            <span className="block text-base font-semibold tracking-tight text-slate-950">
              Waypoint
            </span>
            <span className="block text-xs text-slate-500">
              Career intelligence
            </span>
          </Link>
          {workspaceMode === "personal" ? <nav
            aria-label="Primary navigation"
            className="-mx-1 flex items-center gap-1 overflow-x-auto px-1"
          >
            {navigation.map((item) => {
              const active = "exact" in item && item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`min-h-10 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav> : (
            <button
              type="button"
              onClick={() => void exitWorkspace()}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Exit demo
            </button>
          )}
        </div>
      </header>
      ) : null}
      <div className="flex-1">{children}</div>
      {workspaceMode ? <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
          <span>Waypoint · Personal AI-assisted career intelligence</span>
          <span>Evidence stays reviewable and under your control.</span>
        </div>
      </footer> : null}
    </div>
  );
}

async function exitWorkspace() {
  await fetch("/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: null }),
  });
  window.location.assign("/");
}
