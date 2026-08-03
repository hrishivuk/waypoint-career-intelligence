"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  AuthCard,
  Divider,
  EmailField,
  ErrorNotice,
  GoogleAuthLink,
  inputClass,
  labelClass,
  Notice,
  SubmitButton,
} from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { safeAuthRedirect } from "@/infrastructure/auth/auth-redirect";

export function SignupForm() {
  const params = useSearchParams();
  const next = safeAuthRedirect(params.get("next"));
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password, next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.confirmationRequired) {
        setSent(true);
        setBusy(false);
      } else {
        window.location.assign(body.redirectTo ?? next);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create your account.",
      );
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to resend the confirmation email.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Get started"
      title="Create your Waypoint account"
      description="Your Career Profile, CVs, and job analyses stay private to your account."
    >
      {sent ? (
        <div>
          <Notice>
            Check your email to confirm your account, then return to sign in.
          </Notice>
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void resend()}
            disabled={busy}
            className="w-full"
          >
            {busy ? "Sending…" : "Resend confirmation email"}
          </Button>
        </div>
      ) : (
        <>
          <GoogleAuthLink next={next} />
          <Divider />
          <form className="space-y-5" onSubmit={submit} aria-busy={busy}>
            <div>
              <label htmlFor="signup-name" className={labelClass}>
                Name
              </label>
              <input
                id="signup-name"
                autoComplete="name"
                required
                maxLength={100}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={inputClass}
              />
            </div>
            <EmailField value={email} onChange={setEmail} />
            <div>
              <label htmlFor="signup-password" className={labelClass}>
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="signup-password-help"
                className={inputClass}
              />
              <p
                id="signup-password-help"
                className="mt-2 text-xs text-muted-foreground"
              >
                Use at least 8 characters.
              </p>
            </div>
            {error ? <ErrorNotice>{error}</ErrorNotice> : null}
            <SubmitButton busy={busy} busyText="Creating account…">
              Create account
            </SubmitButton>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
