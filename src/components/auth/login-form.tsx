"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { safeAuthRedirect } from "@/infrastructure/auth/auth-redirect";

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
  const [error, setError] = useState<string | null>(callbackErrors[searchParams.get("error") ?? ""] ?? null);

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
    <AuthCard eyebrow="Welcome back" title="Sign in to Waypoint" description="Continue building your career profile and application materials.">
      {searchParams.get("password") === "updated" ? <Notice>Your password has been updated. You can sign in now.</Notice> : null}
      <a href={`/auth/google?next=${encodeURIComponent(next)}`} className="mt-6 flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
        Continue with Google
      </a>
      <Divider />
      <form className="space-y-4" onSubmit={submit}>
        <EmailField value={email} onChange={setEmail} />
        <label className="block text-sm font-medium text-slate-700">Password
          <input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
        </label>
        <div className="text-right"><Link href="/forgot-password" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">Forgot password?</Link></div>
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <SubmitButton busy={busy} busyText="Signing in…">Sign in</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">New to Waypoint? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-indigo-700 hover:text-indigo-900">Create an account</Link></p>
    </AuthCard>
  );
}

export function AuthCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main id="main-content" className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center px-4 py-12"><div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">{eyebrow}</p><h1 className="mt-3 text-2xl font-semibold text-slate-950">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>{children}</div></main>;
}

export const inputClass = "mt-2 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
export function EmailField({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-slate-700">Email<input type="email" autoComplete="email" required value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>; }
export function ErrorNotice({ children }: { children: React.ReactNode }) { return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{children}</p>; }
export function Notice({ children }: { children: React.ReactNode }) { return <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{children}</p>; }
export function SubmitButton({ busy, busyText, children }: { busy: boolean; busyText: string; children: React.ReactNode }) { return <button disabled={busy} className="min-h-11 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? busyText : children}</button>; }
function Divider() { return <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>; }
