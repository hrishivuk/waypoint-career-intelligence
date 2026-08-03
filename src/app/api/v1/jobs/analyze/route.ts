import { z } from "zod";

import {
  AccountProvisioningRequiredError,
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";
import { safeAiErrorMessage } from "@/infrastructure/ai";
import { analyzeJobDescription } from "@/infrastructure/job-analysis/analyze-job-description";

const MAX_JOB_DESCRIPTION_CHARACTERS = 50_000;
const requestSchema = z
  .object({
    description: z.string().trim().min(80).max(MAX_JOB_DESCRIPTION_CHARACTERS),
    force: z.boolean().optional(),
    reparse: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const { actor, client } = await requireAuthenticatedContext();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: { message: "Provide a valid JSON request." } },
        { status: 400 },
      );
    }
    if (
      typeof body === "object" &&
      body !== null &&
      "description" in body &&
      typeof body.description === "string" &&
      body.description.trim().length > MAX_JOB_DESCRIPTION_CHARACTERS
    ) {
      return Response.json(
        {
          error: {
            message: `Job descriptions cannot exceed ${MAX_JOB_DESCRIPTION_CHARACTERS.toLocaleString("en")} characters.`,
          },
        },
        { status: 413 },
      );
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            message:
              "Provide a complete job description of at least 80 characters.",
          },
        },
        { status: 400 },
      );
    }
    return Response.json(
      await analyzeJobDescription(client, actor.userId, parsed.data.description, {
        force: parsed.data.force === true,
        reparse: parsed.data.reparse === true,
      }),
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json(
        { error: { message: "Authentication required." } },
        { status: 401 },
      );
    }
    if (error instanceof AccountProvisioningRequiredError) {
      return Response.json(
        { error: { message: "Your Waypoint account is still being prepared." } },
        { status: 503 },
      );
    }
    console.error("Job analysis failed", { category: error instanceof Error ? error.name : "UnknownError" });
    return Response.json(
      {
        error: {
          message:
            safeAiErrorMessage(error),
        },
      },
      { status: 500 },
    );
  }
}
