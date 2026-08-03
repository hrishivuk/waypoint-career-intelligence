"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Trash2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [pendingRemoval, setPendingRemoval] = useState<Provider | null>(null);

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
    setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/settings/ai-credentials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: target }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(`${providerDetails[target].name} key removed.`); setPendingRemoval(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove this key."); }
    finally { setBusy(false); }
  }

  const selected = providerDetails[provider];
  const selectedCredential = credentials.find(
    (credential) => credential.provider === provider,
  );

  return (
    <div className="space-y-6" aria-busy={loading || busy}>
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">
          Choose a provider
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["openai", "groq"] as const).map((item) => {
            const saved = credentials.find(
              (credential) => credential.provider === item,
            );
            const active = provider === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setProvider(item)}
                aria-pressed={active}
                className={`min-h-20 rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-[var(--primary-muted)] ring-1 ring-primary"
                    : "border-border bg-[var(--surface-raised)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {providerDetails[item].name}
                  </span>
                  {saved ? (
                    <Badge className="border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]">
                      <CheckCircle2 aria-hidden="true" />
                      Connected
                    </Badge>
                  ) : null}
                </span>
                {loading ? (
                  <Skeleton className="mt-2 h-4 w-32" />
                ) : (
                  <span className="mt-2 block font-mono text-xs text-muted-foreground">
                    {saved
                      ? `${saved.maskedKey} · Verified ${formatDate(saved.verifiedAt)}`
                      : "No key saved"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <form
        onSubmit={save}
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="provider-api-key" className="text-sm font-semibold text-foreground">
            {selected.name} API key
          </label>
          {selectedCredential ? (
            <span className="text-xs text-muted-foreground">
              Enter a new key to replace the saved one
            </span>
          ) : null}
        </div>
        <input
          id="provider-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          minLength={8}
          maxLength={512}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={selected.placeholder}
          aria-describedby="provider-key-help"
          className="mt-2 block min-h-11 w-full rounded-lg border border-input bg-[var(--surface-overlay)] px-3 py-2 font-mono text-sm text-foreground shadow-xs outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <p id="provider-key-help" className="mt-2 text-xs leading-5 text-muted-foreground">
          Waypoint tests the key with {selected.name}, encrypts it on the server,
          and never displays it again.
        </p>

        {error ? (
          <Alert
            variant="destructive"
            className="mt-4 border-[var(--danger-border)] bg-[var(--danger-background)] text-[var(--danger)]"
          >
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Provider settings could not be updated</AlertTitle>
            <AlertDescription className="text-[var(--danger)]">{error}</AlertDescription>
          </Alert>
        ) : null}
        {message ? (
          <Alert
            role="status"
            className="mt-4 border-[var(--success-border)] bg-[var(--success-background)] text-[var(--success)]"
          >
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Provider settings updated</AlertTitle>
            <AlertDescription className="text-[var(--success)]">{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
          <Button type="submit" disabled={busy || loading}>
            <KeyRound aria-hidden="true" data-icon="inline-start" />
            {busy ? "Checking…" : "Test and save key"}
          </Button>
          {selectedCredential ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setPendingRemoval(provider)}
            >
              <Trash2 aria-hidden="true" data-icon="inline-start" />
              Remove saved key
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-sm leading-6 text-muted-foreground">
        An API key is separate from a ChatGPT subscription. AI usage is billed
        by your selected provider. Create or manage your key in the{" "}
        <a
          href={selected.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline"
        >
          {selected.name} API console
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>{" "}
        and review its{" "}
        <a
          href={selected.billingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline"
        >
          billing settings
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        .
      </p>
      <ConfirmationDialog
        open={pendingRemoval !== null}
        title="Remove this provider key?"
        description={
          pendingRemoval
            ? `Your saved ${providerDetails[pendingRemoval].name} key will be permanently removed. AI features using it will stop until you connect another key.`
            : "The saved provider key will be permanently removed."
        }
        confirmLabel="Remove key"
        busy={busy}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingRemoval(null);
        }}
        onConfirm={() => {
          if (pendingRemoval) void remove(pendingRemoval);
        }}
      />
    </div>
  );
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "recently"; }
