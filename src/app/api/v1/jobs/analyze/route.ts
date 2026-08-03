import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";
import { safeAiErrorMessage } from "@/infrastructure/ai";
import { analyzeJobDescription } from "@/infrastructure/job-analysis/analyze-job-description";

export async function POST(request: Request) {
  try {
    const { actor, client } = await requireAuthenticatedContext();
    const body = (await request.json()) as {
      description?: unknown;
      force?: unknown;
      reparse?: unknown;
    };
    if (typeof body.description !== "string") {
      return Response.json(
        { error: { message: "A job description is required." } },
        { status: 400 },
      );
    }
    return Response.json(
      await analyzeJobDescription(client, actor.userId, body.description, {
        force: body.force === true,
        reparse: body.reparse === true,
      }),
    );
  } catch (error) {
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
