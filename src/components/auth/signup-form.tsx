"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { safeAuthRedirect } from "@/infrastructure/auth/auth-redirect";
import { AuthCard, EmailField, ErrorNotice, inputClass, Notice, SubmitButton } from "@/components/auth/login-form";

export function SignupForm() {
  const params = useSearchParams(); const next = safeAuthRedirect(params.get("next"));
  const [displayName, setDisplayName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [sent, setSent] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, email, password, next }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); if (body.confirmationRequired) { setSent(true); setBusy(false); } else window.location.assign(body.redirectTo ?? next); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create your account."); setBusy(false); } }
  async function resend() { setBusy(true); await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setBusy(false); }
  return <AuthCard eyebrow="Get started" title="Create your Waypoint account" description="Your profile, CVs, and job analyses stay private to your account.">{sent ? <><Notice>Check your email to confirm your account, then return to sign in.</Notice><button onClick={resend} disabled={busy} className="mt-4 w-full text-sm font-semibold text-indigo-700 disabled:opacity-50">Resend confirmation email</button></> : <form className="mt-6 space-y-4" onSubmit={submit}><label className="block text-sm font-medium text-slate-700">Name<input autoComplete="name" required maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} /></label><EmailField value={email} onChange={setEmail} /><label className="block text-sm font-medium text-slate-700">Password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Use at least 8 characters.</span></label>{error ? <ErrorNotice>{error}</ErrorNotice> : null}<SubmitButton busy={busy} busyText="Creating account…">Create account</SubmitButton></form>}<p className="mt-5 text-center text-sm text-slate-600">Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-indigo-700">Sign in</Link></p></AuthCard>;
}
