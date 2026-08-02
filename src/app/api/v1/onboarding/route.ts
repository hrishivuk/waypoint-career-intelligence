import { z } from "zod";

import {
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";

export const dynamic = "force-dynamic";

const steps = ["welcome", "provider", "consent", "profile", "cv", "complete"] as const;
const updateSchema = z.object({
  currentStep: z.enum(steps),
  completedStep: z.enum(steps).optional(),
  preferredAiProvider: z.enum(["openai", "groq"]).nullable().optional(),
  acceptAiDataProcessing: z.boolean().optional(),
  completed: z.boolean().optional(),
}).strict();

const noStore = { "Cache-Control": "no-store, private" };

export async function GET() {
  try {
    const { actor, client } = await requireAuthenticatedContext();
    const { data, error } = await client
      .from("user_onboarding_state")
      .select("preferred_ai_provider,current_step,completed_steps,ai_data_processing_accepted_at,completed_at,updated_at")
      .eq("user_id", actor.userId)
      .single();
    if (error) throw error;
    return Response.json({ state: toResponse(data) }, { headers: noStore });
  } catch (error) {
    return handleError(error, "Unable to load onboarding progress.");
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid onboarding update." }, { status: 400, headers: noStore });
    }
    const { actor, client } = await requireAuthenticatedContext();
    const current = await client
      .from("user_onboarding_state")
      .select("completed_steps,ai_data_processing_accepted_at")
      .eq("user_id", actor.userId)
      .single();
    if (current.error) throw current.error;

    const completedSteps = new Set<string>(current.data.completed_steps ?? []);
    if (parsed.data.completedStep) completedSteps.add(parsed.data.completedStep);
    const acceptedAt = parsed.data.acceptAiDataProcessing
      ? new Date().toISOString()
      : current.data.ai_data_processing_accepted_at;
    if (parsed.data.completed && !acceptedAt) {
      return Response.json({ error: "Accept the AI data-processing notice before finishing onboarding." }, { status: 400, headers: noStore });
    }

    const update: Record<string, unknown> = {
      current_step: parsed.data.currentStep,
      completed_steps: [...completedSteps],
    };
    if (parsed.data.preferredAiProvider !== undefined) {
      update.preferred_ai_provider = parsed.data.preferredAiProvider;
    }
    if (parsed.data.acceptAiDataProcessing) update.ai_data_processing_accepted_at = acceptedAt;
    if (parsed.data.completed) update.completed_at = new Date().toISOString();

    const saved = await client
      .from("user_onboarding_state")
      .update(update)
      .eq("user_id", actor.userId)
      .select("preferred_ai_provider,current_step,completed_steps,ai_data_processing_accepted_at,completed_at,updated_at")
      .single();
    if (saved.error) throw saved.error;
    return Response.json({ state: toResponse(saved.data) }, { headers: noStore });
  } catch (error) {
    return handleError(error, "Unable to save onboarding progress.");
  }
}

function toResponse(row: Record<string, unknown>) {
  return {
    preferredAiProvider: row.preferred_ai_provider ?? null,
    currentStep: row.current_step,
    completedSteps: row.completed_steps ?? [],
    aiDataProcessingAcceptedAt: row.ai_data_processing_accepted_at ?? null,
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at,
  };
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Cross-origin mutation rejected.");
}

function handleError(error: unknown, fallback: string) {
  return error instanceof AuthenticationRequiredError
    ? Response.json({ error: "Authentication required." }, { status: 401, headers: noStore })
    : Response.json({ error: fallback }, { status: 500, headers: noStore });
}
