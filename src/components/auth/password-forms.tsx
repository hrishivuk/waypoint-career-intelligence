"use client";

import Link from "next/link";
import { useState } from "react";

import {
  AuthCard,
  EmailField,
  ErrorNotice,
  inputClass,
  labelClass,
  Notice,
  SubmitButton,
} from "@/components/auth/login-form";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to send recovery email.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your email and we'll send a secure recovery link."
    >
      {sent ? (
        <Notice>
          If an account exists for that address, a recovery email is on its way.
        </Notice>
      ) : (
        <form className="mt-6 space-y-5" onSubmit={submit} aria-busy={busy}>
          <EmailField
            value={email}
            onChange={setEmail}
            invalid={Boolean(error)}
            describedBy={error ? "recovery-error" : undefined}
          />
          {error ? (
            <ErrorNotice id="recovery-error">{error}</ErrorNotice>
          ) : null}
          <SubmitButton busy={busy} busyText="Sending…">
            Send recovery email
          </SubmitButton>
        </form>
      )}
      <Link
        href="/login"
        className="mt-6 block min-h-11 py-3 text-center text-sm font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline"
      >
        Back to sign in
      </Link>
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.assign(body.redirectTo);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update password.",
      );
      setBusy(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Use at least 8 characters and avoid reusing an old password."
    >
      <form className="mt-6 space-y-5" onSubmit={submit} aria-busy={busy}>
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          describedBy="new-password-help"
        />
        <p id="new-password-help" className="-mt-3 text-xs text-muted-foreground">
          Use at least 8 characters.
        </p>
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          invalid={Boolean(error)}
          describedBy={error ? "reset-password-error" : undefined}
        />
        {error ? (
          <ErrorNotice id="reset-password-error">{error}</ErrorNotice>
        ) : null}
        <SubmitButton busy={busy} busyText="Updating…">
          Update password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        minLength={8}
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
