"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { safeAuthRedirect } from "@/infrastructure/auth/auth-redirect";
import { cn } from "@/lib/utils";

const callbackErrors: Record<string, string> = {
  callback: "That sign-in link is invalid or has expired. Please try again.",
  oauth: "Google sign-in couldn't be started. Please try again.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeAuthRedirect(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    callbackErrors[searchParams.get("error") ?? ""] ?? null,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.assign(body.redirectTo ?? next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
      setBusy(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in to Waypoint"
      description="Continue building your Career Profile and making evidence-based job decisions."
    >
      {searchParams.get("password") === "updated" ? (
        <Notice>Your password has been updated. You can sign in now.</Notice>
      ) : null}

      <GoogleAuthLink next={next} />
      <Divider />

      <form className="space-y-5" onSubmit={submit} aria-busy={busy}>
        <EmailField
          value={email}
          onChange={setEmail}
          invalid={Boolean(error)}
          describedBy={error ? "login-error" : undefined}
        />
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor="login-password" className={labelClass}>
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-[var(--link)] hover:text-[var(--link-hover)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            className={inputClass}
          />
        </div>

        {error ? <ErrorNotice id="login-error">{error}</ErrorNotice> : null}
        <SubmitButton busy={busy} busyText="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Waypoint?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center px-4 py-10 sm:px-6 sm:py-16"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-6 top-16 -z-10 h-48 rounded-full bg-[var(--primary-muted)] opacity-70 blur-3xl"
      />
      <Card className="w-full bg-card py-0 shadow-md">
        <CardHeader className="border-b border-[var(--border-subtle)] px-6 py-6 sm:px-8 sm:py-7">
          <Link
            href="/"
            className="mb-6 w-fit text-sm font-semibold tracking-tight text-foreground hover:text-[var(--link)]"
          >
            Waypoint
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </CardHeader>
        <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
          {children}
        </CardContent>
      </Card>
    </main>
  );
}

export const inputClass =
  "mt-2 block min-h-11 w-full rounded-lg border border-input bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-strong)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15";
export const labelClass = "block text-sm font-medium text-foreground";

export function EmailField({
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div>
      <label htmlFor="auth-email" className={labelClass}>
        Email address
      </label>
      <input
        id="auth-email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={inputClass}
      />
    </div>
  );
}

export function ErrorNotice({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <Alert id={id} variant="destructive" aria-live="assertive">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Alert
      role="status"
      aria-live="polite"
      className="mb-6 border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]"
    >
      <AlertDescription className="text-[var(--success)]">{children}</AlertDescription>
    </Alert>
  );
}

export function SubmitButton({
  busy,
  busyText,
  children,
}: {
  busy: boolean;
  busyText: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="submit"
      disabled={busy}
      aria-disabled={busy}
      className="w-full"
    >
      <span aria-live="polite">{busy ? busyText : children}</span>
    </Button>
  );
}

export function GoogleAuthLink({ next }: { next: string }) {
  return (
    <a
      href={`/auth/google?next=${encodeURIComponent(next)}`}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "mt-6 w-full bg-[var(--surface-raised)]",
      )}
    >
      <GoogleMark />
      Continue with Google
    </a>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
      <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        or use email
      </span>
      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="currentColor"
        opacity=".78"
        d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        opacity=".58"
        d="M6.39 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.27.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.48l3.35-2.62Z"
      />
      <path
        fill="currentColor"
        opacity=".9"
        d="M12 6.01c1.47 0 2.78.5 3.81 1.49l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z"
      />
    </svg>
  );
}
