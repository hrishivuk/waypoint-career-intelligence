"use client";

import {
  BookOpenText,
  BriefcaseBusiness,
  FileText,
  Home,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";

import {
  isNavigationItemActive,
  primaryNavigation,
  utilityNavigation,
  type NavigationItem,
} from "@/components/navigation/navigation-model";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const icons: Record<string, ComponentType<{ className?: string }>> = {
  "/": Home,
  "/knowledge": UserRound,
  "/cvs": FileText,
  "/jobs": BriefcaseBusiness,
  "/application-kit": BookOpenText,
  "/settings": Settings,
};

const accountRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

export function AppShell({
  children,
  authenticated,
}: {
  children: ReactNode;
  authenticated: boolean;
}) {
  const pathname = usePathname();
  const showProductChrome =
    authenticated &&
    pathname !== "/onboarding" &&
    !accountRoutes.some((route) => pathname.startsWith(route));

  if (!showProductChrome) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[70] -translate-y-24 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>

      <DesktopSidebar pathname={pathname} />

      <div className="min-w-0">
        <MobileHeader pathname={pathname} />
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link
      href="/"
      className="group flex min-h-11 items-center gap-3 rounded-xl px-2 text-sidebar-foreground"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <Sparkles className="size-[18px]" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-base font-semibold tracking-tight">Waypoint</span>
        <span className="block text-xs text-[var(--sidebar-muted)]">Career intelligence</span>
      </span>
    </Link>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  return (
    <aside
      data-sidebar
      className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex"
    >
      <div className="px-1">
        <Brand />
      </div>

      <Link
        href="/jobs/new"
        className={cn(buttonVariants({ size: "default" }), "mt-7 w-full")}
      >
        <Sparkles aria-hidden="true" />
        Analyse a job
      </Link>

      <NavigationList
        pathname={pathname}
        items={primaryNavigation}
        label="Primary navigation"
        className="mt-6"
      />

      <div className="mt-auto border-t border-sidebar-border pt-3">
        <NavigationList
          pathname={pathname}
          items={utilityNavigation}
          label="Account navigation"
        />
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-[var(--sidebar-muted)] transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-[18px]" aria-hidden="true" />
          Sign out
        </button>
        <div className="mt-3 flex gap-4 px-3 text-xs text-[var(--sidebar-muted)]">
          <Link href="/privacy" className="hover:text-sidebar-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-sidebar-foreground">Terms</Link>
        </div>
      </div>
    </aside>
  );
}

function MobileHeader({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      data-sidebar
      className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden"
    >
      <Brand />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Open navigation"
          className="flex size-11 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Menu className="size-5" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[min(22rem,88vw)] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="border-b border-sidebar-border px-4 py-5 text-left">
            <SheetTitle className="text-sidebar-foreground">Waypoint</SheetTitle>
            <SheetDescription className="text-[var(--sidebar-muted)]">
              Career intelligence workspace
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <Link
              href="/jobs/new"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ size: "default" }), "w-full")}
            >
              <Sparkles aria-hidden="true" />
              Analyse a job
            </Link>
            <NavigationList
              pathname={pathname}
              items={primaryNavigation}
              label="Primary navigation"
              className="mt-5"
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-auto border-t border-sidebar-border pt-3">
              <NavigationList
                pathname={pathname}
                items={utilityNavigation}
                label="Account navigation"
                onNavigate={() => setOpen(false)}
              />
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--sidebar-muted)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="size-[18px]" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function NavigationList({
  pathname,
  items,
  label,
  className,
  onNavigate,
}: {
  pathname: string;
  items: readonly NavigationItem[];
  label: string;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = icons[item.href];
          const active = isNavigationItemActive(pathname, item.href, item.aliases);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-[var(--sidebar-muted)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {Icon ? <Icon className="size-[18px]" aria-hidden="true" /> : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.assign("/");
}
