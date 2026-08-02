"use client";

import { useEffect, useState } from "react";

import { buttonStyles } from "@/components/ui";

type Provider = "openai" | "groq";
type Credential = { provider: Provider; maskedKey: string; verifiedAt: string | null; updatedAt: string };

const providerDetails = {
  openai: { name: "OpenAI", keyUrl: "https://platform.openai.com/api-keys", billingUrl: "https://platform.openai.com/settings/organization/billing/overview", placeholder: "sk-…" },
  groq: { name: "Groq", keyUrl: "https://console.groq.com/keys", billingUrl: "https://console.groq.com/settings/billing", placeholder: "gsk_…" },
} as const;

export function AiProviderSettings({ onSaved }: { onSaved?: (provider: Provider) => void }) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/v1/settings/ai-credentials", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setCredentials(body.credentials ?? []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load provider settings.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/v1/settings/ai-credentials", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setCredentials(body.credentials ?? []);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load provider settings.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/settings/ai-credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setApiKey(""); setMessage(`${providerDetails[provider].name} key verified and saved.`);
      await load(); onSaved?.(provider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify this key.");
    } finally { setBusy(false); }
  }

  async function remove(target: Provider) {
    if (!window.confirm(`Remove your saved ${providerDetails[target].name} key? AI features using it will stop working.`)) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/settings/ai-credentials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: target }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(`${providerDetails[target].name} key removed.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove this key."); }
    finally { setBusy(false); }
  }

  const selected = providerDetails[provider];
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2">{(["openai", "groq"] as const).map((item) => { const saved = credentials.find((credential) => credential.provider === item); return <button key={item} type="button" onClick={() => setProvider(item)} aria-pressed={provider === item} className={`rounded-xl border p-4 text-left transition ${provider === item ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 bg-white hover:border-slate-300"}`}><span className="block font-semibold text-slate-950">{providerDetails[item].name}</span><span className="mt-1 block text-xs text-slate-500">{saved ? `${saved.maskedKey} · Verified ${formatDate(saved.verifiedAt)}` : "No key saved"}</span></button>; })}</div>
    <form onSubmit={save} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <label className="block text-sm font-semibold text-slate-900">{selected.name} API key<input type="password" autoComplete="off" spellCheck={false} required minLength={8} maxLength={512} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={selected.placeholder} className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-950 placeholder:text-slate-400" /></label>
      <p className="mt-2 text-xs leading-5 text-slate-500">Saving first tests the key with {selected.name}. Your key is encrypted on the server and is never shown again.</p>
      {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy || loading} className={buttonStyles.primary}>{busy ? "Checking…" : "Test and save key"}</button>{credentials.some((credential) => credential.provider === provider) ? <button type="button" disabled={busy} onClick={() => void remove(provider)} className={buttonStyles.secondary}>Remove saved key</button> : null}</div>
    </form>
    <p className="text-sm leading-6 text-slate-600">An API key is separate from a ChatGPT subscription. AI usage is billed by your selected provider. Create or manage your key in the <a href={selected.keyUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 underline">{selected.name} API console</a> and review its <a href={selected.billingUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 underline">billing settings</a>.</p>
  </div>;
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "recently"; }
