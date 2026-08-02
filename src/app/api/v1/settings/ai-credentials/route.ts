import { z } from "zod";

import {
  AiProviderSchema,
  UserCredentialRepository,
  classifyProviderError,
} from "@/infrastructure/ai";
import {
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  provider: AiProviderSchema,
  apiKey: z.string().trim().min(8).max(512),
}).strict();
const deleteSchema = z.object({ provider: AiProviderSchema }).strict();

const noStore = { "Cache-Control": "no-store, private" };

export async function GET() {
  try {
    const { actor } = await requireAuthenticatedContext();
    const credentials = await new UserCredentialRepository(getSupabaseServerClient(), actor.userId).list();
    return Response.json({ credentials }, { headers: noStore });
  } catch (error) {
    return error instanceof AuthenticationRequiredError
      ? Response.json({ error: "Authentication required." }, { status: 401, headers: noStore })
      : Response.json({ error: "Unable to load AI provider settings." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Enter a valid provider API key." }, { status: 400, headers: noStore });
    }
    const { actor, client } = await requireAuthenticatedContext();
    await verifyCredential(parsed.data.provider, parsed.data.apiKey);
    await new UserCredentialRepository(getSupabaseServerClient(), actor.userId).save(
      parsed.data.provider,
      parsed.data.apiKey,
      true,
    );
    const { error: preferenceError } = await client
      .from("user_onboarding_state")
      .update({ preferred_ai_provider: parsed.data.provider })
      .eq("user_id", actor.userId);
    if (preferenceError) throw preferenceError;
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    const safe = classifyProviderError(error);
    const status = safe.code === "INVALID_CREDENTIAL" ? 401 : 502;
    return Response.json({ error: safe.message, code: safe.code }, { status, headers: noStore });
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Choose a supported provider." }, { status: 400, headers: noStore });
    }
    const { actor } = await requireAuthenticatedContext();
    await new UserCredentialRepository(getSupabaseServerClient(), actor.userId).remove(parsed.data.provider);
    return Response.json({ ok: true }, { headers: noStore });
  } catch {
    return Response.json({ error: "Unable to remove the provider key." }, { status: 500, headers: noStore });
  }
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new Error("Cross-origin mutation rejected.");
  }
}

async function verifyCredential(provider: z.infer<typeof AiProviderSchema>, apiKey: string) {
  const endpoint = provider === "groq"
    ? "https://api.groq.com/openai/v1/models"
    : "https://api.openai.com/v1/models";
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const error = new Error("Provider credential validation failed.") as Error & { status: number };
    error.status = response.status;
    throw error;
  }
}
